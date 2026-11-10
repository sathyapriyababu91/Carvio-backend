const User = require("../model/user.model");
const Car = require("../model/car.model");

// GET USER PROFILE

const getUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId)
      .select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      user
    });

  } catch (err) {
    console.log("GET USER PROFILE ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};


// UPDATE USER PROFILE

const updateUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;

    const {
      name,
      email,
      phone,
      address
    } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (name !== undefined) {
      user.name = name;
    }

    if (email !== undefined) {
      user.email = email;
    }

    if (phone !== undefined) {
      user.phone = phone;
    }

    if (address !== undefined) {
      user.address = {
        city: address.city || "",
        state: address.state || "",
        pincode: address.pincode || ""
      };
    }

    const updatedUser = await user.save();

    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "Profile updated successfully!",
      user: userResponse
    });

  } catch (err) {
    console.log("UPDATE USER PROFILE ERROR:", err);

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email or phone number already exists"
      });
    }

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};


// ADD / REMOVE FAVOURITE

const toggleFavourite = async (req, res) => {
  try {
    const userId = req.user.id;
    const carId = req.params.carId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const car = await Car.findById(carId);

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found"
      });
    }

    const alreadyFavourite = user.favourites.some(
      (id) => id.toString() === carId
    );

    if (alreadyFavourite) {
      user.favourites = user.favourites.filter(
        (id) => id.toString() !== carId
      );

      await user.save();

      return res.status(200).json({
        success: true,
        message: "Removed from favourites",
        isFavourite: false
      });
    }

    user.favourites.push(carId);

    await user.save();

    res.status(200).json({
      success: true,
      message: "Added to favourites",
      isFavourite: true
    });

  } catch (err) {
    console.log("TOGGLE FAVOURITE ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};


// GET MY FAVOURITES

const getMyFavourites = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate("favourites");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      favourites: user.favourites || []
    });

  } catch (err) {
    console.log("GET FAVOURITES ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};


module.exports = {
  getUserProfile,
  updateUserProfile,
  toggleFavourite,
  getMyFavourites
};
