const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const {
  registerUser,
  loginUser,
  sendOTP,
  verifyOTP,
  changePassword,
  logoutAllDevices,
  getCurrentUser
} = require("../controller/auth.controller");

const verifyToken = require("../middleware/auth.middleware");

// RATE LIMITERS (per IP)

// Send OTP: max 5 requests per 15 minutes
const sendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP requests. Please try again after 15 minutes."
  }
});

// Verify OTP: max 10 requests per 15 minutes
const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again after 15 minutes."
  }
});

// Email/password login: max 10 requests per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes."
  }
});

// REGISTER
router.post(
  "/register",
  registerUser
);

// EMAIL/PASSWORD LOGIN
router.post(
  "/login",
  loginLimiter,
  loginUser
);

// SEND OTP
router.post(
  "/send-otp",
  sendOtpLimiter,
  sendOTP
);

// VERIFY OTP
router.post(
  "/verify-otp",
  verifyOtpLimiter,
  verifyOTP
);

// CHANGE PASSWORD
router.put(
  "/change-password",
  verifyToken,
  changePassword
);

// GET CURRENT USER (session check)
router.get(
  "/me",
  verifyToken,
  getCurrentUser
);

// LOGOUT ALL DEVICES
router.post(
  "/logout-all",
  verifyToken,
  logoutAllDevices
);

module.exports = router;