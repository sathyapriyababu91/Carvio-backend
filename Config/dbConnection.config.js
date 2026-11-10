const mongoose = require("mongoose");

const dbConnection = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Database Connected");
    console.log(
      "Database Name:",
      mongoose.connection.name
    );

  } catch (err) {
    console.log(err.message);
    process.exit(1);
  }
};

module.exports = dbConnection;
