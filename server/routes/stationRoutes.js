const express = require("express");
const router = express.Router();
const axios = require("axios");
const EVStation = require("../models/EVStation");

/* ================= GET SAVED STATIONS ================= */
router.get("/stations", async (req, res) => {
  try {
    const stations = await EVStation.find();
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ================= POST NEW STATION ================= */
router.post("/stations", async (req, res) => {
  try {
    const { name, latitude, longitude, chargerType, address } = req.body;

    const newStation = new EVStation({
      name,
      latitude,
      longitude,
      chargerType,
      address
    });

    const saved = await newStation.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =====================================================
   ROUTE-BASED EV SEARCH (NO 504 VERSION)
   /api/route?start=Bengaluru&end=Mysuru
   ===================================================== */
router.get("/route", async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ message: "Start and end required" });
    }

    /* ---------- 1️⃣ GEOCODE START & END (NOMINATIM) ---------- */
    const [startGeo, endGeo] = await Promise.all([
      axios.get(
        `https://nominatim.openstreetmap.org/search?q=${start}&format=json&limit=1`,
        { headers: { "User-Agent": "ev-app" }, timeout: 5000 }
      ),
      axios.get(
        `https://nominatim.openstreetmap.org/search?q=${end}&format=json&limit=1`,
        { headers: { "User-Agent": "ev-app" }, timeout: 5000 }
      )
    ]);

    if (!startGeo.data.length || !endGeo.data.length) {
      return res.status(404).json({ message: "Location not found" });
    }

    const startLat = startGeo.data[0].lat;
    const startLng = startGeo.data[0].lon;
    const endLat = endGeo.data[0].lat;
    const endLng = endGeo.data[0].lon;

    /* ---------- 2️⃣ ROUTE FROM OSRM ---------- */
    const routeRes = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`,
      { timeout: 5000 }
    );

    const routeCoords = routeRes.data.routes[0].geometry.coordinates;

    /* ---------- 3️⃣ STRATEGIC CHECKPOINTS ---------- */
    const checkpoints = [
      routeCoords[0],
      routeCoords[Math.floor(routeCoords.length / 2)],
      routeCoords[Math.floor(routeCoords.length * 0.75)],
      routeCoords[routeCoords.length - 1]
    ];

    /* ---------- 4️⃣ EV STATIONS NEAR CHECKPOINTS ---------- */
    const stationMap = new Map();

    for (const [lng, lat] of checkpoints) {
      const query = `
        [out:json][timeout:10];
        node["amenity"="charging_station"]
        (around:5000,${lat},${lng});
        out;
      `;

      try {
        const evRes = await axios.post(
          "https://overpass-api.de/api/interpreter",
          query,
          {
            headers: { "Content-Type": "text/plain" },
            timeout: 10000
          }
        );

        evRes.data.elements.forEach(station => {
          stationMap.set(station.id, station);
        });
      } catch {
        // Ignore timeout at individual checkpoints
      }
    }

    /* ---------- 5️⃣ RESPONSE ---------- */
    res.json({
      start: { lat: startLat, lng: startLng },
      end: { lat: endLat, lng: endLng },
      totalStations: stationMap.size,
      stations: Array.from(stationMap.values())
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;