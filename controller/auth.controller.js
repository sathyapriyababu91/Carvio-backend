const User = require("../model/user.model");
const OTP = require("../model/otp.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;

// MSG91 helper - sends OTP SMS to a real mobile number

const sendSMSViaMSG91 = async (phone, otp) => {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId) {
    throw new Error("MSG91_NOT_CONFIGURED");
  }

  // Keep digits only, add India country code if 10 digit number
  let mobile = String(phone).replace(/\D/g, "");

  if (mobile.length === 10) {
    mobile = "91" + mobile;
  }

  const url =
    "https://control.msg91.com/api/v5/otp" +
    "?template_id=" + encodeURIComponent(templateId) +
    "&mobile=" + encodeURIComponent(mobile) +
    "&authkey=" + encodeURIComponent(authKey) +
    "&otp=" + encodeURIComponent(otp) +
    "&otp_expiry=5";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ OTP: otp })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.type === "error") {
    console.error("MSG91 ERROR:", data);
    throw new Error(data.message || "Failed to send SMS");
  }

  return data;
};
// 1. REGISTER USER

const registerUser = async (req, res) => {
  try {
    const { address } = req.body;

    const name = req.body.name;
    const password = req.body.password;
    const phone = String(req.body.phone ?? "").trim();
    const email = req.body.email
      ? String(req.body.email).trim().toLowerCase()
      : undefined;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone number and password are required!"
      });
    }

    // Check if user already exists
    const conditions = [{ phone }];

    if (email) {
      conditions.push({ email });
    }

    const existingUser = await User.findOne({
      $or: conditions
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email or phone number!"
      });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(
      password,
      salt
    );

    // Create New User
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      address
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully!"
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};



// 2. LOGIN USER - EMAIL/PASSWORD


const loginUser = async (req, res) => {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required!"
      });
    }

    // Find User
    const user = await User.findOne({
      email
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found!"
      });
    }

    // Check Password
    const isMatch = user.password
      ? await bcrypt.compare(password, user.password)
      : false;

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials!"
      });
    }

    // Generate JWT Token
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role
      },
      process.env.JWT_SECRET || "secret_key",
      {
        expiresIn: "7d"
      }
    );

    res.status(200).json({
      success: true,
      message: "Login successful!",
      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role
      }
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};



// 3. SEND OTP - PHONE LOGIN


const sendOTP = async (req, res) => {
  try {
    const phone = String(req.body.phone ?? "").trim();

    // Check phone number
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required!"
      });
    }

    // Check user exists
    const existingUser = await User.findOne({
      phone
    });

    // For LOGIN, user must already exist
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "No account found with this phone number. Please register first."
      });
    }

    // Resend cooldown (protects SMS credits)
    const recentOTP = await OTP.findOne({
      phone
    });

    if (recentOTP && recentOTP.createdAt) {
      const waitSeconds = Math.ceil(
        (OTP_RESEND_SECONDS * 1000 -
          (Date.now() - recentOTP.createdAt.getTime())) / 1000
      );

      if (waitSeconds > 0) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitSeconds} seconds before requesting a new OTP.`
        });
      }
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    // Store only the hash of the OTP
    const hashedOtp = await bcrypt.hash(otp, 10);

    // OTP expires after 5 minutes
    const expiresAt =
      new Date(
        Date.now() + 5 * 60 * 1000
      );

    // Remove old OTP
    await OTP.deleteMany({
      phone
    });

    // Save new OTP
    const newOTP = new OTP({
      phone,
      otp: hashedOtp,
      expiresAt
    });

    await newOTP.save();

    // Send OTP SMS through MSG91
    try {
      await sendSMSViaMSG91(phone, otp);
    } catch (smsErr) {

      // Local development only: MSG91 not configured, return OTP in response
      if (
        smsErr.message === "MSG91_NOT_CONFIGURED" &&
        process.env.NODE_ENV === "development"
      ) {
        return res.status(200).json({
          success: true,
          message: "OTP generated (dev mode, SMS not sent)!",
          otp: otp
        });
      }

      // SMS failed, remove saved OTP
      await OTP.deleteMany({
        phone
      });

      console.error("SEND SMS ERROR:", smsErr);

      return res.status(500).json({
        success: false,
        message: "Could not send OTP SMS. Please try again."
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your mobile number!"
    });

  } catch (err) {
    console.error("SEND OTP ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};



// 4. VERIFY OTP - PHONE LOGIN


const verifyOTP = async (req, res) => {
  try {
    const phone = String(req.body.phone ?? "").trim();
    const otp = String(req.body.otp ?? "").trim();

    // Check phone and OTP
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required!"
      });
    }

    // Find OTP and count this attempt in one step
    const otpRecord = await OTP.findOneAndUpdate(
      { phone },
      { $inc: { attempts: 1 } },
      { new: true }
    );

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP!"
      });
    }

    // Check OTP expiry
    if (
      otpRecord.expiresAt < new Date()
    ) {
      await OTP.deleteOne({
        _id: otpRecord._id
      });

      return res.status(400).json({
        success: false,
        message: "OTP has expired!"
      });
    }

    // Too many attempts
    if (otpRecord.attempts > OTP_MAX_ATTEMPTS) {
      await OTP.deleteOne({
        _id: otpRecord._id
      });

      return res.status(429).json({
        success: false,
        message: "Too many wrong attempts. Please request a new OTP."
      });
    }

    // Compare entered OTP with the stored hash
    const isOtpMatch = await bcrypt.compare(
      otp,
      otpRecord.otp
    );

    if (!isOtpMatch) {
      if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
        await OTP.deleteOne({
          _id: otpRecord._id
        });

        return res.status(429).json({
          success: false,
          message: "Too many wrong attempts. Please request a new OTP."
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid OTP!"
      });
    }

    // Find user
    const user = await User.findOne({
      phone
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found!"
      });
    }

    // Delete OTP after successful verification (single use)
    const consumed = await OTP.deleteOne({
      _id: otpRecord._id
    });

    if (consumed.deletedCount !== 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP!"
      });
    }

    // Generate JWT Token
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role
      },
      process.env.JWT_SECRET || "secret_key",
      {
        expiresIn: "7d"
      }
    );

    // Login success response
    res.status(200).json({
      success: true,
      message: "OTP verified successfully!",

      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role
      }
    });

  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};



// 5. CHANGE PASSWORD


const changePassword = async (req, res) => {
  try {

    // User ID comes from JWT middleware
    const userId = req.user.id;

    const {
      currentPassword,
      newPassword
    } = req.body;


    // VALIDATION

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required!"
      });
    }


    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters!"
      });
    }


    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password!"
      });
    }


    // FIND USER

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found!"
      });
    }


    // CHECK CURRENT PASSWORD

    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect!"
      });
    }


    // HASH NEW PASSWORD

    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(
      newPassword,
      salt
    );


    // SAVE NEW PASSWORD

    user.password = hashedPassword;

    await user.save();


    // SUCCESS

    res.status(200).json({
      success: true,
      message: "Password changed successfully!"
    });

  } catch (err) {

    console.error(
      "CHANGE PASSWORD ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};



// EXPORT


module.exports = {
  registerUser,
  loginUser,
  sendOTP,
  verifyOTP,
  changePassword
};