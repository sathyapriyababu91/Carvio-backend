const express = require("express");

const router = express.Router();

// Controller
const {
  addCar,
  getAllCars,
  getCarById,
  reactivateCar,
  getMyAds,
  updateCar
} = require("../controller/car.controller");

// Authentication Middleware
const verifyToken = require("../middleware/auth.middleware");

// 1. Test Route
router.get("/", (req, res) => {
  res.send("Car Route Working!");
});

// 2. Add Vehicle
// Login required
router.post("/add", verifyToken, addCar);

// 3. Get All Vehicles
// Public
router.get("/all", getAllCars);

// 4. Get My Ads
// Login required
router.get("/my-ads", verifyToken, getMyAds);


// 5. Reactivate Listing
// Login required
router.put("/reactivate/:id", verifyToken, reactivateCar);

router.put("/:id", verifyToken, updateCar);

// 6. Get Single Vehicle
// Public
router.get("/:id", getCarById);

module.exports = router;
