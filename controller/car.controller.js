const Car = require("../model/car.model");
const User = require("../model/user.model");

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
    if (numericPrice < 10000) {
      return null;
    }

    if (numericPrice <= 500000) {
      return 250;
    }

    if (numericPrice <= 1000000) {
      return 300;
    }


    return 500;
  }

  return null;
};
// FREE LISTING VALIDITY

const FREE_LISTING_DAYS = 30;


// FIRST FREE LISTING ONLY
// Free listing is allowed only if:
// 1. the user's category flag is not already marked as used, AND
// 2. this seller has no earlier FREE listing in the Car collection
//    for the same vehicle type (protects against a reset/missing flag)

const canUseFreeListing = async (user, vehicleType) => {
  if (user.freeListingUsedByCategory?.[vehicleType] === true) {
    return false;
  }

  const earlierFreeListing = await Car.exists({
    seller: user._id,
    vehicleType,
    isFreeListing: true
  });

  return !earlierFreeListing;
};

// 1. ADD NEW VEHICLE


const addCar = async (req, res) => {

  try {

    // User ID comes from JWT middleware
    const seller = req.user.id;

    const {
      vehicleType,
      title,
      brand,
      variant,
      modelName,
      year,
      condition,
      kmsDriven,
      fuelType,
      transmission,
      ownerType,
      price,
      paymentMethod,
      location,
      description,
      images
    } = req.body;

    // VALIDATE VEHICLE TYPE

    const validVehicleTypes = [
      "Car",
      "Two Wheeler",
      "Commercial Vehicle"
    ];

    if (
      !vehicleType ||
      !validVehicleTypes.includes(vehicleType)
    ) {

      return res.status(400).json({
        success: false,
        message: "Valid vehicle type is required"
      });

    }


    // VALIDATE VEHICLE PRICE

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid vehicle price"
      });
    }

    if (
      (vehicleType === "Car" ||
        vehicleType === "Commercial Vehicle") &&
      numericPrice < 10000
    ) {
      return res.status(400).json({
        success: false,
        message: "Car and Commercial Vehicle price must be at least ₹10,000"
      });
    }

    // FIND LOGGED-IN USER


    const user = await User.findById(seller);

    if (!user) {

      return res.status(404).json({
        success: false,
        message: "User not found"
      });

    }

    // MODEL NAME

    const finalModelName =
      modelName || variant;

    if (!finalModelName) {

      return res.status(400).json({
        success: false,
        message: "Vehicle model is required"
      });

    }




    // COMMON VEHICLE DATA


    const vehicleData = {

      vehicleType,

      title,

      brand,

      modelName: finalModelName,

      year,

      condition,

      kmsDriven,

      fuelType,

      transmission,

      ownerType,

      price,

      paymentMethod,

      location,

      description,

      images,

      seller: user._id

    };

    // CHECK FREE LISTING
    const freeListingAvailable =
      await canUseFreeListing(user, vehicleType);
    
if (freeListingAvailable) {
  const expiryDate = new Date();

  expiryDate.setDate(
    expiryDate.getDate() + FREE_LISTING_DAYS
  );

  const freeCar = new Car({
    ...vehicleData,
    isFreeListing: true,
    listingFee: 0,
    paymentStatus: "FREE",
    status: "ACTIVE",
    expiresAt: expiryDate
  });

  // Save the vehicle
  const savedCar = await freeCar.save();

  // Mark this category's free listing as used
  const usedAt = new Date();

  user.set(
    `freeListingUsedByCategory.${vehicleType}`,
    true
  );

  user.set(
    `freeListingUsedAtByCategory.${vehicleType}`,
    usedAt
  );

  await user.save();

  return res.status(201).json({
    success: true,
    message: `Your ${vehicleType} listing is FREE for ${FREE_LISTING_DAYS} days.`,
    paymentRequired: false,
    amount: 0,
    car: savedCar
  });
}
    // PAID LISTING

    const listingFee = getListingFee(
      vehicleType,
      numericPrice
    );

    if (listingFee === null) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle type or vehicle price"
      });
    }

    // CREATE PENDING LISTING


    const pendingCar = new Car({

      ...vehicleData,

      isFreeListing: false,

      listingFee,

      paymentStatus: "PENDING",

      status: "PENDING_PAYMENT",

      expiresAt: null

    });



    const savedPendingCar =
      await pendingCar.save();



    return res.status(201).json({

      success: true,

      message:
        `₹${listingFee} payment is required to publish this ${vehicleType}.`,

      paymentRequired: true,

      amount: listingFee,

      carId: savedPendingCar._id,

      vehicleType,

      car: savedPendingCar

    });



  } catch (err) {

    console.error(
      "ADD VEHICLE ERROR:",
      err
    );

    return res.status(500).json({

      success: false,

      message: "Unable to add vehicle",

      error: err.message

    });

  }

};

// 2. GET ALL ACTIVE VEHICLES

const getAllCars = async (req, res) => {
  try {
    const now = new Date();

    // 1. Automatically deactivate expired listings
    await Car.updateMany(
      {
        status: "ACTIVE",
        expiresAt: {
          $ne: null,
          $lte: now,
        },
      },
      {
        $set: {
          status: "DEACTIVATED",
        },
      }
    );

    // 2. Expired booster packs return to normal listing
    await Car.updateMany(
      {
        boostStatus: "ACTIVE",
        boostEndDate: {
          $ne: null,
          $lte: now,
        },
      },
      {
        $set: {
          boostStatus: "NONE",
          boostType: null,
          boostStartDate: null,
          boostEndDate: null,
        },
      }
    );

    // 3. Get all active vehicles
    const cars = await Car.find({
      status: "ACTIVE",
    }).populate("seller", "name phone");

    // 4. Sort boosted vehicles first
    cars.sort((a, b) => {
      const aBoostActive =
        a.boostStatus === "ACTIVE" &&
        a.boostEndDate &&
        new Date(a.boostEndDate) > now;

      const bBoostActive =
        b.boostStatus === "ACTIVE" &&
        b.boostEndDate &&
        new Date(b.boostEndDate) > now;

      // Active boosted vehicles come first
      if (aBoostActive && !bBoostActive) return -1;
      if (!aBoostActive && bBoostActive) return 1;

      // If both are boosted, later expiry comes first
      if (aBoostActive && bBoostActive) {
        return (
          new Date(b.boostEndDate) -
          new Date(a.boostEndDate)
        );
      }

      // Normal vehicles: newest listing comes first
      return (
        new Date(b.createdAt) -
        new Date(a.createdAt)
      );
    });

    return res.status(200).json({
      success: true,
      cars,
    });

  } catch (err) {
    console.error(
      "GET ALL VEHICLES ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Unable to get vehicles",
      error: err.message,
    });
  }
};

// 3. GET SINGLE VEHICLE


const getCarById = async (req, res) => {

  try {

    const car =
      await Car.findById(
        req.params.id
      )
        .populate(
          "seller",
          "name phone"
        );



    if (!car) {

      return res.status(404).json({

        success: false,

        message: "Vehicle not found"

      });

    }



    // Automatically deactivate expired vehicle

    if (

      car.status === "ACTIVE" &&

      car.expiresAt &&

      car.expiresAt <= new Date()

    ) {

      car.status = "DEACTIVATED";

      await car.save();

    }



    // Expired booster pack returns to normal listing

    if (

      car.boostStatus === "ACTIVE" &&

      car.boostEndDate &&

      car.boostEndDate <= new Date()

    ) {

      car.boostStatus = "NONE";

      car.boostType = null;

      car.boostStartDate = null;

      car.boostEndDate = null;

      await car.save();

    }



    return res.status(200).json({

      success: true,

      car

    });



  } catch (err) {

    console.error(
      "GET VEHICLE ERROR:",
      err
    );

    return res.status(500).json({

      success: false,

      message: "Unable to get vehicle",

      error: err.message

    });

  }

};




// 4. GET MY ADS


const getMyAds = async (req, res) => {

  try {

    // Get user from JWT

    const seller = req.user.id;



    const user =
      await User.findById(seller);



    if (!user) {

      return res.status(404).json({

        success: false,

        message: "User not found"

      });

    }



    // Automatically deactivate expired ads

    await Car.updateMany(

      {

        seller: user._id,

        status: "ACTIVE",

        expiresAt: {

          $ne: null,

          $lte: new Date()

        }

      },

      {

        $set: {

          status: "DEACTIVATED"

        }

      }

    );



    // Expired booster packs return to normal listing

    await Car.updateMany(

      {

        seller: user._id,

        boostStatus: "ACTIVE",

        boostEndDate: {

          $ne: null,

          $lte: new Date()

        }

      },

      {

        $set: {

          boostStatus: "NONE",

          boostType: null,

          boostStartDate: null,

          boostEndDate: null

        }

      }

    );



    // Get only this user's ads

    const cars =
      await Car.find({

        seller: user._id,

        status: {

          $in: [

            "ACTIVE",

            "DEACTIVATED"

          ]

        }

      })

        .sort({

          createdAt: -1

        });



    return res.status(200).json({

      success: true,

      cars

    });



  } catch (err) {

    console.error(
      "GET MY ADS ERROR:",
      err
    );

    return res.status(500).json({

      success: false,

      message: "Unable to get your ads",

      error: err.message

    });

  }

};




// 5. REACTIVATE VEHICLE


const reactivateCar = async (req, res) => {

  try {

    const { id } = req.params;

    // Logged-in user from JWT

    const seller = req.user.id;



    const car =
      await Car.findById(id);



    if (!car) {

      return res.status(404).json({

        success: false,

        message: "Vehicle not found"

      });

    }




    // OWNERSHIP CHECK


    if (
      car.seller.toString() !==
      seller.toString()
    ) {

      return res.status(403).json({

        success: false,

        message:
          "You are not authorized to reactivate this vehicle"

      });

    }




    // ACTIVE CHECK


    if (car.status === "ACTIVE") {

      return res.status(400).json({

        success: false,

        message:
          "This vehicle is already active"

      });

    }




    // PENDING PAYMENT CHECK


    if (
      car.status === "PENDING_PAYMENT"
    ) {

      return res.status(400).json({

        success: false,

        message:
          "This vehicle already has a pending payment"

      });

    }




    // GET REACTIVATION FEE
const reactivationFee = getListingFee(
  car.vehicleType,
  Number(car.price)
);
    if (!reactivationFee) {

      return res.status(400).json({

        success: false,

        message:
          "Invalid vehicle type"

      });

    }



    return res.status(200).json({

      success: true,

      message:
        `${car.vehicleType} reactivation requires ₹${reactivationFee}.`,

      paymentRequired: true,

      amount: reactivationFee,

      carId: car._id,

      vehicleType:
        car.vehicleType

    });



  } catch (err) {

    console.error(
      "REACTIVATE ERROR:",
      err
    );

    return res.status(500).json({

      success: false,

      message:
        "Unable to process reactivation",

      error: err.message

    });

  }

};

// 6. UPDATE VEHICLE

const updateCar = async (req, res) => {
  try {
    const { id } = req.params;
    const seller = req.user.id;

    const {
      brand,
      modelName,
      variant,
      year,
      condition,
      kmsDriven,
      fuelType,
      transmission,
      ownerType,
      price,
      location,
      description,
      images
    } = req.body;

    const car = await Car.findById(id);

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found"
      });
    }

    // OWNERSHIP CHECK
    if (car.seller.toString() !== seller.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this vehicle"
      });
    }

    // DO NOT CHANGE A LISTING WHILE PAYMENT IS PENDING
    if (car.status === "PENDING_PAYMENT") {
      return res.status(400).json({
        success: false,
        message: "Please complete or cancel the pending payment before editing this listing"
      });
    }

    // MODEL NAME
    const finalModelName = modelName || variant;

    if (!finalModelName) {
      return res.status(400).json({
        success: false,
        message: "Vehicle model is required"
      });
    }

    // PRICE VALIDATION
    const numericPrice = Number(price);

    if (price === undefined || price === null || price === "" ||
        !Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid vehicle price"
      });
    }

    if (
      (car.vehicleType === "Car" ||
       car.vehicleType === "Commercial Vehicle") &&
      numericPrice < 10000
    ) {
      return res.status(400).json({
        success: false,
        message: "Car and Commercial Vehicle price must be at least ₹10,000"
      });
    }

    // UPDATE VEHICLE
    car.brand = brand;
    car.modelName = finalModelName;
    car.title = `${brand} ${finalModelName}`;
    car.year = year;
    car.condition = condition;
    car.kmsDriven = kmsDriven;
    car.fuelType = fuelType;
    car.transmission = transmission;
    car.ownerType = ownerType;
    car.price = numericPrice;
    car.location = location;
    car.description = description;

    if (images) {
      car.images = images;
    }

    const updatedCar = await car.save();

    return res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      car: updatedCar
    });

  } catch (err) {
    console.error("UPDATE VEHICLE ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to update vehicle",
      error: err.message
    });
  }
};

// EXPORT


module.exports = {

  addCar,

  getAllCars,

  getCarById,

  getMyAds,

  reactivateCar,
  updateCar

};