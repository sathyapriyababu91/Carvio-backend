
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    car: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      default: null,
      immutable: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [1, "Payment amount must be at least ₹1"],
      validate: {
        validator: (value) =>
          Number.isFinite(value) && Number.isInteger(value),
        message: "Payment amount must be a valid whole number",
      },
      immutable: true,
    },

    purpose: {
      type: String,
      enum: [
        "VEHICLE_LISTING",
        "REACTIVATION",
        "BOOSTER_PACK",
      ],
      required: true,
      immutable: true,
    },

    boostType: {
      type: String,
      enum: ["15_DAYS", "30_DAYS"],
      default: null,
      immutable: true,
    },

    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
      trim: true,
    },

    razorpaySignature: {
      type: String,
      default: null,
      validate: {
        validator: (value) =>
          value === null ||
          /^[a-f0-9]{64}$/i.test(value),
        message: "Invalid Razorpay signature format",
      },
    },

    status: {
      type: String,
      enum: ["CREATED", "PAID", "FAILED"],
      default: "CREATED",
      required: true,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  }
);

// Useful for finding a user's recent payments
paymentSchema.index({
  user: 1,
  createdAt: -1,
});

// Useful for filtering payments by status
paymentSchema.index({
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Payment", paymentSchema);
