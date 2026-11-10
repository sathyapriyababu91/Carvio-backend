const express = require("express");

const router = express.Router();

const {
  getUserProfile,
  updateUserProfile,
  toggleFavourite,
  getMyFavourites
} = require("../controller/user.controller");

const verifyToken = require("../middleware/auth.middleware");

// GET USER PROFILE

router.get("/profile/:id", getUserProfile);

// UPDATE USER PROFILE

router.put("/update/:id", updateUserProfile);

// ADD / REMOVE FAVOURITE

router.put(
  "/favourite/:carId",
  verifyToken,
  toggleFavourite
);

// GET MY FAVOURITES

router.get(
  "/favourites",
  verifyToken,
  getMyFavourites
);

module.exports = router;
