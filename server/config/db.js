const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://Anushreehemadri:3LV7yktNSyysb6i0@cluster0.tcuwutg.mongodb.net/?appName=Cluster0");
    console.log("MongoDB connected");
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

module.exports = connectDB;
