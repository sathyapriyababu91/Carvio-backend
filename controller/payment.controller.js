const crypto = require("crypto");

const razorpay = require("../Config/razorpay");

const Payment = require("../model/payment.model");
const Car = require("../model/car.model");


// LISTING FEE

const getListingFee = (vehicleType, price) => {
  const numericPrice = Number(price);

  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return null;
  }

  if (vehicleType === "Two Wheeler") {
    return 200;
  }

  if (
    vehicleType === "Car" ||
    vehicleType === "Commercial Vehicle"
  ) {
    if (numericPrice < 10000) return null;
    if (numericPrice <= 500000) return 250;
    if (numericPrice <= 1000000) return 300;

    return 500;
  }

  return null;
};
// BOOSTER PACK PRICES AND DURATIONS

const BOOSTER_PACKS = {
  "15_DAYS": {
    price: 250,
    days: 15,
  },
  "30_DAYS": {
    price: 500,
    days: 30,
  },
};

// A booster order that was created but never paid (user closed the
// Razorpay popup) must not block the seller forever.
// Only an order created within this window counts as "pending".
const PENDING_BOOST_WINDOW_MINUTES = 15;


// 1. CREATE RAZORPAY ORDER


const createPaymentOrder = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      purpose,
      carId,
      boostType,
    } = req.body;

    const paymentPurpose = purpose || "VEHICLE_LISTING";

    if (
      ![
        "VEHICLE_LISTING",
        "REACTIVATION",
        "BOOSTER_PACK",
      ].includes(paymentPurpose)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment purpose",
      });
    }

    if (!carId) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }

    const car = await Car.findById(carId);

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Vehicle listing not found",
      });
    }

    if (car.seller.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to pay for this listing",
      });
    }

    // BOOSTER PACK PAYMENT

    if (paymentPurpose === "BOOSTER_PACK") {
      if (!boostType) {
        return res.status(400).json({
          success: false,
          message: "Booster pack is required",
        });
      }

      // CHECK EXISTING PENDING BOOSTER PAYMENT
      // (only recent unpaid orders; old abandoned ones are ignored)

const pendingSince = new Date(
  Date.now() - PENDING_BOOST_WINDOW_MINUTES * 60 * 1000
);

const existingPendingPayment = await Payment.findOne({
  user: userId,
  car: car._id,
  purpose: "BOOSTER_PACK",
  status: "CREATED",
  createdAt: { $gte: pendingSince },
});

if (existingPendingPayment) {
  return res.status(409).json({
    success: false,
    message: "A booster payment is already pending for this vehicle. Please complete that payment first.",
  });
}

      const selectedPack = BOOSTER_PACKS[boostType];

      if (!selectedPack) {
        return res.status(400).json({
          success: false,
          message: "Invalid booster pack",
        });
      }

      if (car.status !== "ACTIVE") {
        return res.status(400).json({
          success: false,
          message: "Only active listings can be boosted",
        });
      }

      if (
        car.boostStatus === "ACTIVE" &&
        car.boostEndDate &&
        new Date(car.boostEndDate) > new Date()
      ) {
        return res.status(400).json({
          success: false,
          message: "This vehicle already has an active boost",
        });
      }

      const order = await razorpay.orders.create({
        amount: selectedPack.price * 100,
        currency: "INR",
        receipt: `carvio_boost_${Date.now()}`,
        notes: {
          purpose: "BOOSTER_PACK",
          carId: car._id.toString(),
          seller: userId.toString(),
          vehicleType: car.vehicleType,
          boostType,
        },
      });

      const newPayment = new Payment({
        user: userId,
        car: car._id,
        amount: selectedPack.price,
        purpose: "BOOSTER_PACK",
        boostType,
        razorpayOrderId: order.id,
        status: "CREATED",
      });

      await newPayment.save();

      return res.status(200).json({
        success: true,
        message: "Booster payment order created successfully",
        keyId: process.env.RAZORPAY_KEY_ID,
        amount: selectedPack.price,
        boostType,
        durationDays: selectedPack.days,
        order,
      });
    }

    // VEHICLE LISTING / REACTIVATION PAYMENT

    if (paymentPurpose === "VEHICLE_LISTING") {
      if (car.status !== "PENDING_PAYMENT") {
        return res.status(400).json({
          success: false,
          message: "This listing is not waiting for payment",
        });
      }
    }

    if (paymentPurpose === "REACTIVATION") {
      if (car.status !== "DEACTIVATED") {
        return res.status(400).json({
          success: false,
          message: "Only deactivated listings can be reactivated",
        });
      }
    }

    const listingFee = getListingFee(
      car.vehicleType,
      car.price
    );

    if (listingFee === null) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle type or price",
      });
    }

    const order = await razorpay.orders.create({
      amount: listingFee * 100,
      currency: "INR",
      receipt:
        paymentPurpose === "REACTIVATION"
          ? `carvio_reactivate_${Date.now()}`
          : `carvio_listing_${Date.now()}`,
      notes: {
        purpose: paymentPurpose,
        carId: car._id.toString(),
        seller: userId.toString(),
        vehicleType: car.vehicleType,
      },
    });

    const newPayment = new Payment({
      user: userId,
      car: car._id,
      amount: listingFee,
      purpose: paymentPurpose,
      razorpayOrderId: order.id,
      status: "CREATED",
    });

    await newPayment.save();

    return res.status(200).json({
      success: true,
      message:
        paymentPurpose === "REACTIVATION"
          ? "Reactivation payment order created successfully"
          : "Payment order created successfully",
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: listingFee,
      vehicleType: car.vehicleType,
      order,
    });
  } catch (err) {
    console.error("RAZORPAY ORDER ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : undefined,
    });
  }
};


// 2. VERIFY RAZORPAY PAYMENT


const verifyPayment = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment details are required",
      });
    }

    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    if (payment.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to verify this payment",
      });
    }

    // IDEMPOTENCY CHECK

    if (payment.status === "PAID") {
      if (
        payment.razorpayPaymentId !== razorpay_payment_id
      ) {
        return res.status(409).json({
          success: false,
          message: "This order was already paid using another payment",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        paymentId: payment.razorpayPaymentId,
        orderId: payment.razorpayOrderId,
        carId: payment.car,
      });
    }

    if (payment.status !== "CREATED") {
      return res.status(400).json({
        success: false,
        message: "This payment cannot be verified",
      });
    }

    // VERIFY RAZORPAY SIGNATURE

    if (
      !process.env.RAZORPAY_KEY_SECRET ||
      !/^[a-f0-9]{64}$/i.test(razorpay_signature)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest();

    const receivedSignature = Buffer.from(
      razorpay_signature,
      "hex"
    );

    if (
      receivedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(
        expectedSignature,
        receivedSignature
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed",
      });
    }

    // VERIFY ORDER AND CAPTURED PAYMENT WITH RAZORPAY

    const [order, razorpayPayment] = await Promise.all([
      razorpay.orders.fetch(razorpay_order_id),
      razorpay.payments.fetch(razorpay_payment_id),
    ]);

    const expectedAmountPaise = payment.amount * 100;

    if (
      order.id !== payment.razorpayOrderId ||
      order.amount !== expectedAmountPaise ||
      order.currency !== "INR"
    ) {
      return res.status(400).json({
        success: false,
        message: "Razorpay order amount or currency mismatch",
      });
    }

    if (
      razorpayPayment.id !== razorpay_payment_id ||
      razorpayPayment.order_id !== razorpay_order_id ||
      razorpayPayment.amount !== expectedAmountPaise ||
      razorpayPayment.currency !== "INR" ||
      razorpayPayment.status !== "captured"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment is not captured or payment details do not match",
      });
    }

    // VERIFY ORDER METADATA

    if (
      order.notes?.carId !== payment.car?.toString() ||
      order.notes?.seller !== userId.toString() ||
      order.notes?.purpose !== payment.purpose ||
      (
        payment.purpose === "BOOSTER_PACK" &&
        order.notes?.boostType !== payment.boostType
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment order details do not match",
      });
    }

    // VERIFY BOOSTER PACK PRICE

    if (payment.purpose === "BOOSTER_PACK") {
      const selectedPack = BOOSTER_PACKS[payment.boostType];

      if (
        !selectedPack ||
        payment.amount !== selectedPack.price
      ) {
        return res.status(400).json({
          success: false,
          message: "Booster pack amount does not match",
        });
      }
    }

    // FIND VEHICLE AND VERIFY OWNERSHIP

    const car = await Car.findById(payment.car);

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Vehicle listing not found",
      });
    }

    if (car.seller.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this listing",
      });
    }

    // ACTIVATE BOOSTER AFTER VERIFIED PAYMENT

    if (payment.purpose === "BOOSTER_PACK") {
      if (car.status !== "ACTIVE") {
        return res.status(400).json({
          success: false,
          message: "Only active listings can be boosted",
        });
      }

      if (
        car.boostStatus === "ACTIVE" &&
        car.boostEndDate &&
        new Date(car.boostEndDate) > new Date()
      ) {
        return res.status(409).json({
          success: false,
          message: "This vehicle already has an active boost",
        });
      }

      const selectedPack = BOOSTER_PACKS[payment.boostType];

      const now = new Date();
      const boostEndDate = new Date(now);

      boostEndDate.setDate(
        boostEndDate.getDate() + selectedPack.days
      );

      car.boostStatus = "ACTIVE";
      car.boostType = payment.boostType;
      car.boostStartDate = now;
      car.boostEndDate = boostEndDate;
      car.boostPaymentId = razorpay_payment_id;

      await car.save();

      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      payment.status = "PAID";

      await payment.save();

      return res.status(200).json({
        success: true,
        message: "Booster Pack activated successfully",
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        carId: car._id,
        boostType: payment.boostType,
        boostEndDate,
      });
    }

    // VERIFY LISTING / REACTIVATION FEE

    const currentFee = getListingFee(
      car.vehicleType,
      car.price
    );

    if (
      currentFee === null ||
      currentFee !== payment.amount
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Listing fee has changed. Please create a new payment order",
      });
    }

    // VERIFY LISTING STATUS

    if (payment.purpose === "VEHICLE_LISTING") {
      if (car.status !== "PENDING_PAYMENT") {
        return res.status(400).json({
          success: false,
          message: "Vehicle listing is not pending payment",
        });
      }
    } else if (payment.purpose === "REACTIVATION") {
      if (car.status !== "DEACTIVATED") {
        return res.status(400).json({
          success: false,
          message: "Vehicle listing is not deactivated",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid payment purpose",
      });
    }

    // ACTIVATE LISTING

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    car.paymentStatus = "PAID";
    car.status = "ACTIVE";
    car.listingFee = payment.amount;
    car.expiresAt = expiryDate;

    if (payment.purpose === "VEHICLE_LISTING") {
      car.isFreeListing = false;
    }

    await car.save();

    // SAVE VERIFIED PAYMENT

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = "PAID";

    await payment.save();

    return res.status(200).json({
      success: true,
      message:
        payment.purpose === "REACTIVATION"
          ? "Vehicle reactivated successfully"
          : "Payment verified and vehicle listing activated successfully",
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      carId: car._id,
    });
  } catch (err) {
    console.error("PAYMENT VERIFICATION ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  }
};


// 3. LOGGED-IN USER PAYMENT HISTORY


const getMyPayments = async (req, res) => {
  try {
    const userId =
      req.user.id ||
      req.user._id ||
      req.user.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    const payments = await Payment.find({
      user: userId,
      status: { $in: ["PAID", "FAILED"] },
    })
      .select("-razorpaySignature")
      .populate("car", "title brand modelName vehicleType")
      .sort({ createdAt: -1 })
      .lean();

    const result = payments.map((payment) => ({
      ...payment,
      paidAt:
        payment.status === "PAID"
          ? payment.updatedAt
          : null,
    }));

    return res.status(200).json({
      success: true,
      payments: result,
    });
  } catch (err) {
    console.error("MY PAYMENTS ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to load payments",
    });
  }
};


// EXPORT


module.exports = {
  createPaymentOrder,
  verifyPayment,
  getMyPayments,
};