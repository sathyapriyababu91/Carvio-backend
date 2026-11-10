const mongoose = require("mongoose");

const carSchema = new mongoose.Schema(
  {
    // VEHICLE CATEGORY
    vehicleType: {
      type: String,
      enum: ["Car", "Two Wheeler", "Commercial Vehicle"],
      required: true
    },

    // BASIC DETAILS
    title: {
      type: String,
      required: true,
      trim: true
    },

    brand: {
      type: String,
      required: true,
      trim: true
    },

    modelName: {
      type: String,
      required: true,
      trim: true
    },

    year: {
      type: Number,
      required: true
    },

    
    // BODY TYPE
    bodyType: {
      type: String,
      enum: ["Hatchback", "Sedan", "SUV", "MUV", "Luxury"],
      default: null
    },


    // VEHICLE CONDITION
    condition: {
      type: String,
       enum: ["New", "Used", "Used Car", "Pre-Owned"],
      required: true,
    },

    // SPECIFICATIONS
    kmsDriven: {
      type: Number,
      required: true
    },

    fuelType: {
      type: String,
      enum: ["Petrol", "Diesel", "CNG", "Electric"],
      required: true
    },

    transmission: {
      type: String,
      enum: ["Manual", "Automatic"],
      required: true
    },

    ownerType: {
      type: String,
      enum: [
        "1st Owner",
        "2nd Owner",
        "3rd Owner",
        "4th Owner",
        '4+ Owners',
      ],
      default: "1st Owner"
    },

    // PRICE
    price: {
      type: Number,
      required: true
    },

    // PAYMENT METHOD SELECTED BY SELLER
    paymentMethod: {
      type: String,
      enum: [
        "GPay",
        "PhonePe",
        "Bank Transfer",
        "Finance / Loan"
      ],
      required: true
    },

    // LOCATION
    location: {
      type: String,
      required: true
    },

    // DESCRIPTION
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },

    // VEHICLE IMAGES
    images: [
      {
        type: String
      }
    ],

    // SELLER
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // LISTING PAYMENT
    isFreeListing: {
      type: Boolean,
      default: false
    },

    listingFee: {
      type: Number,
      default: 0
    },

    paymentStatus: {
      type: String,
      enum: ["FREE", "PENDING", "PAID", "FAILED"],
      default: "FREE"
    },

// BOOSTER PACK
boostStatus: {
  type: String,
  enum: ["NONE", "PENDING", "ACTIVE", "EXPIRED"],
  default: "NONE"
},

boostType: {
  type: String,
  enum: ["15_DAYS", "30_DAYS"],
  default: null
},

boostStartDate: {
  type: Date,
  default: null
},

boostEndDate: {
  type: Date,
  default: null
},

boostPaymentId: {
  type: String,
  default: null
},

    // LISTING STATUS
    status: {
      type: String,
      enum: [
        "ACTIVE",
        "DEACTIVATED",
        "PENDING_PAYMENT"
      ],
      default: "ACTIVE"
    },

    // LISTING EXPIRY
    expiresAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Car", carSchema);