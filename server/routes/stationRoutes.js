const express = require("express");
const router = express.Router();
const EVStation = require("../models/EVStation");


// ===============================
// GET: Fetch all EV stations
// URL: http://localhost:5000/api/stations
// ===============================
router.get("/stations", async (req, res) => {
  try {
    const stations = await EVStation.find();
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ===============================
// POST: Add new EV station
// URL: http://localhost:5000/api/stations
// ===============================
router.post("/stations", async (req, res) => {
  try {
    const { name, latitude, longitude, chargerType, address } = req.body;

    const newStation = new EVStation({
      name,
      latitude,
      longitude,
      chargerType,
      address,
    });

    const savedStation = await newStation.save();
    res.status(201).json(savedStation);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ===============================
module.exports = router;
