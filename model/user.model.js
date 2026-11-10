
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },

    password: {
      type: String,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    address: {
      city: {
        type: String,
      },

      state: {
        type: String,
      },

      pincode: {
        type: String,
      },
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // Legacy free listing fields
    freeListingUsed: {
      type: Boolean,
      default: false,
    },

    freeListingUsedAt: {
      type: Date,
      default: null,
    },

    // Separate free listing for each vehicle category
    freeListingUsedByCategory: {
      Car: {
        type: Boolean,
        default: false,
      },

      "Two Wheeler": {
        type: Boolean,
        default: false,
      },

      "Commercial Vehicle": {
        type: Boolean,
        default: false,
      },
    },

    freeListingUsedAtByCategory: {
      Car: {
        type: Date,
        default: null,
      },

      "Two Wheeler": {
        type: Date,
        default: null,
      },

      "Commercial Vehicle": {
        type: Date,
        default: null,
      },
    },

    favourites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Car",
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", UserSchema);
