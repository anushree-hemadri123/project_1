const mongoose = require("mongoose");

const evStationSchema = new mongoose.Schema({
  name: String,
  latitude: Number,
  longitude: Number,
  chargerType: String,
  address: String,
});

module.exports = mongoose.model("EVStation", evStationSchema);
