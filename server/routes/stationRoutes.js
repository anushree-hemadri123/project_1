const express = require("express");
const router = express.Router();
const axios = require("axios");
const EVStation = require("../models/EVStation");

/* ================= DISTANCE FUNCTION ================= */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


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
   ROUTE + EV STATIONS + LONG GAP DETECTION
   /api/route?start=Bangalore&end=Mysore
   ===================================================== */
router.get("/route", async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ message: "Start and end required" });
    }

    /* ---------- 1️⃣ GEOCODE ---------- */
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

    const startLat = parseFloat(startGeo.data[0].lat);
    const startLng = parseFloat(startGeo.data[0].lon);
    const endLat = parseFloat(endGeo.data[0].lat);
    const endLng = parseFloat(endGeo.data[0].lon);

    /* ---------- 2️⃣ ROUTE ---------- */
    const routeRes = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`,
      { timeout: 7000 }
    );

    const routeCoords = routeRes.data.routes[0].geometry.coordinates;

    /* ---------- 3️⃣ CHECKPOINTS ---------- */
    const checkpoints = [];

    const step = Math.floor(routeCoords.length / 40); // ~40 checkpoints

    for (let i = 0; i < routeCoords.length; i += step) {
      checkpoints.push(routeCoords[i]);
    }


    /* ---------- 4️⃣ FETCH STATIONS ---------- */
    const stationMap = new Map();

    for (const [lng, lat] of checkpoints) {
      const query = `
        [out:json][timeout:10];
        node["amenity"="charging_station"]
        (around:6000,${lat},${lng});
        out;
      `;

      try {
        const evRes = await axios.post(
          "https://overpass-api.de/api/interpreter",
          query,
          { headers: { "Content-Type": "text/plain" }, timeout: 10000 }
        );

        evRes.data.elements.forEach(s => stationMap.set(s.id, s));
      } catch { }
    }

    const stationsArray = Array.from(stationMap.values());

    /* ---------- 5️⃣ SORT STATIONS ---------- */
    stationsArray.sort((a, b) => {
      const distA = haversine(startLat, startLng, a.lat, a.lon);
      const distB = haversine(startLat, startLng, b.lat, b.lon);
      return distA - distB;
    });


    /* ---------- 6️⃣ LONG GAP DETECTION ---------- */
    const warnings = [];
    const SAFE_RANGE = 300;   // km
    const BUFFER = 80;        // km

    stationsArray.unshift({
      lat: startLat,
      lon: startLng,
      tags: { name: "Start Location" }
    });

    stationsArray.push({
      lat: endLat,
      lon: endLng,
      tags: { name: "Destination" }
    });


    for (let i = 0; i < stationsArray.length - 1; i++) {
      const s1 = stationsArray[i];
      const s2 = stationsArray[i + 1];

      const dist = haversine(s1.lat, s1.lon, s2.lat, s2.lon);

      if (dist > SAFE_RANGE - BUFFER) {
        const extra = dist - (SAFE_RANGE - BUFFER);
        const minutes = Math.ceil((extra / 60) * 10);

        warnings.push({
          from: s1.tags?.name || "Station",
          to: s2.tags?.name || "Next Station",
          distanceKm: Math.round(dist),
          message: "Long stretch without EV station",
          suggestedChargeTime: `${minutes} minutes`
        });
      }
    }

    /* ---------- 7️⃣ RESPONSE ---------- */
    res.json({
      start: { lat: startLat, lng: startLng },
      end: { lat: endLat, lng: endLng },
      totalStations: stationsArray.length,
      stations: stationsArray,
      warnings
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;