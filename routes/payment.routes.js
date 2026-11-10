const express = require("express");

const {
  createPaymentOrder,
  verifyPayment,
  getMyPayments,
} = require("../controller/payment.controller");
const verifyToken = require("../middleware/auth.middleware");

const router = express.Router();

// Create Razorpay order
router.post("/create-order", verifyToken, createPaymentOrder);

// Verify Razorpay payment
router.post("/verify", verifyToken, verifyPayment);

// Logged-in user's payment history
router.get("/my-payments", verifyToken, getMyPayments);

module.exports = router;