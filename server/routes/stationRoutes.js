const express = require("express");
const router = express.Router();
const axios = require("axios");

/* ================= DISTANCE FUNCTION ================= */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ================= ROUTE DISTANCE FUNCTION ================= */
// Calculates total distance along polyline between two indices
function calculateRouteDistance(routeCoords, startIndex, endIndex) {
  let totalDist = 0;
  if (startIndex < 0) startIndex = 0;
  if (endIndex >= routeCoords.length) endIndex = routeCoords.length - 1;

  for (let i = startIndex; i < endIndex; i++) {
    const [lat1, lon1] = routeCoords[i];
    const [lat2, lon2] = routeCoords[i + 1];
    totalDist += haversine(lat1, lon1, lat2, lon2);
  }
  return totalDist;
}

/* ================= DECODE OSRM POLYLINE ================= */
function decodePolyline(encoded) {
  const coords = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;

    shift = 0; result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;

    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

/* ================= GET BOUNDING BOX OF ROUTE ================= */
// Returns a slightly padded bounding box covering all route coords
function getBoundingBox(coords, paddingDeg = 0.3) {
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;

  coords.forEach(([lat, lon]) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  });

  return {
    south: minLat - paddingDeg,
    west: minLon - paddingDeg,
    north: maxLat + paddingDeg,
    east: maxLon + paddingDeg,
  };
}

/* ================= SAMPLE WAYPOINTS ================= */
function sampleWaypoints(coords, numSamples) {
  if (coords.length <= numSamples) return coords;
  const step = (coords.length - 1) / (numSamples - 1);
  const sampled = [];
  for (let i = 0; i < numSamples; i++) {
    sampled.push(coords[Math.round(i * step)]);
  }
  return sampled;
}

/* ================= POINT-TO-SEGMENT DISTANCE ================= */
// Checks if a station is within `thresholdKm` of the route polyline
// Returns the index of the closest route point if within threshold, else -1
function getRouteProgressIndex(stLat, stLon, routeCoords, thresholdKm = 15) {
  let minIndex = -1;
  let minDistance = Infinity;

  // Sample intelligently for performance
  const step = Math.max(1, Math.floor(routeCoords.length / 500));

  for (let i = 0; i < routeCoords.length; i += step) {
    const [lat, lon] = routeCoords[i];
    const dist = haversine(stLat, stLon, lat, lon);
    if (dist <= thresholdKm && dist < minDistance) {
      minDistance = dist;
      minIndex = i;
    }
  }
  return minIndex;
}

/* ===================================================== */
/* ================= ROUTE API ========================= */
/* ===================================================== */
router.get("/route", async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ message: "Start and end required" });
    }

    /* ================= GEOCODING ================= */
    const [startGeo, endGeo] = await Promise.all([
      axios.get(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(start)}&format=json&limit=1&countrycodes=in`,
        { headers: { "User-Agent": "ev-app" }, timeout: 8000 }
      ),
      axios.get(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(end)}&format=json&limit=1&countrycodes=in`,
        { headers: { "User-Agent": "ev-app" }, timeout: 8000 }
      )
    ]);

    if (!startGeo.data.length || !endGeo.data.length) {
      return res.status(404).json({ message: "Location not found" });
    }

    const startLat = parseFloat(startGeo.data[0].lat);
    const startLng = parseFloat(startGeo.data[0].lon);
    const endLat = parseFloat(endGeo.data[0].lat);
    const endLng = parseFloat(endGeo.data[0].lon);

    console.log(`Route: [${startLat},${startLng}] → [${endLat},${endLng}]`);

    /* ================= GET ROUTE WITH GEOMETRY ================= */
    const routeRes = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline`,
      { timeout: 10000 }
    );

    let routeCoords = [];
    if (routeRes.data.routes && routeRes.data.routes.length > 0) {
      routeCoords = decodePolyline(routeRes.data.routes[0].geometry);
    } else {
      routeCoords = [[startLat, startLng], [endLat, endLng]];
    }

    console.log(`Route decoded: ${routeCoords.length} points`);

    /* ================= BOUNDING BOX QUERY FOR STATIONS ================= */
    const bbox = getBoundingBox(routeCoords, 0.2); // Reduced padding for tighter focus
    console.log(`BBox: S=${bbox.south.toFixed(2)} W=${bbox.west.toFixed(2)} N=${bbox.north.toFixed(2)} E=${bbox.east.toFixed(2)}`);

    // nwr = node, way, relation (covers stations mapped as polygons)
    const overpassQuery = `
      [out:json][timeout:30];
      (
        nwr["amenity"="charging_station"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      );
      out center;
    `;

    let allStations = [];
    try {
      const stationRes = await axios({
        method: 'post',
        url: 'https://overpass-api.de/api/interpreter',
        data: overpassQuery, // Send query in data field
        headers: { "Content-Type": "text/plain" },
        timeout: 25000
      });

      // Handle center for ways/relations
      allStations = (stationRes.data.elements || []).map(st => ({
        ...st,
        lat: st.lat || st.center?.lat,
        lon: st.lon || st.center?.lon
      })).filter(st => st.lat && st.lon);

      console.log(`Overpass returned ${allStations.length} usable stations in bounding box`);
    } catch (ovErr) {
      console.error("Overpass error:", ovErr.message);
    }

    /* ================= FILTER & ATTACH PROGRESS ================= */
    let stationsAlongRoute = [];
    allStations.forEach(st => {
      const progressIndex = getRouteProgressIndex(st.lat, st.lon, routeCoords, 15);
      if (progressIndex !== -1) {
        stationsAlongRoute.push({
          ...st,
          _progress: progressIndex
        });
      }
    });

    console.log(`Stations refined to route (within 15km): ${stationsAlongRoute.length}`);

    /* ================= SORT by route progress ================= */
    stationsAlongRoute.sort((a, b) => a._progress - b._progress);

    let stationsArray = stationsAlongRoute;

    /* ================= ADD START & END MARKERS ================= */
    stationsArray.unshift({
      lat: startLat,
      lon: startLng,
      tags: { name: "Start: " + start },
      _progress: 0
    });
    stationsArray.push({
      lat: endLat,
      lon: endLng,
      tags: { name: "Destination: " + end },
      _progress: routeCoords.length - 1
    });

    /* ================= GAP WARNINGS ================= */
    const SAFE_RANGE = 180; // km EV range
    const BUFFER = 40;  // km safety margin
    const warnings = [];

    for (let i = 0; i < stationsArray.length - 1; i++) {
      const s1 = stationsArray[i];
      const s2 = stationsArray[i + 1];

      // Use route-based distance instead of haversine
      const dist = calculateRouteDistance(routeCoords, s1._progress, s2._progress);
      console.log(`Checking gap ${i}: ${s1.tags?.name} -> ${s2.tags?.name} = ${dist.toFixed(2)} km`);

      if (dist > SAFE_RANGE - BUFFER) {
        const extra = dist - (SAFE_RANGE - BUFFER);
        const minutes = Math.ceil((extra / 60) * 10);
        console.log(`  ! WARNING ADDED: Gap is ${dist.toFixed(2)}km`);
        warnings.push({
          from: s1.tags?.name || "Station",
          to: s2.tags?.name || "Next Station",
          distanceKm: Math.round(dist),
          message: "Long stretch without EV station",
          suggestedChargeTime: `${minutes} minutes`
        });
      }
    }

    /* ================= RESPONSE ================= */
    res.json({
      start: { lat: startLat, lng: startLng },
      end: { lat: endLat, lng: endLng },
      totalStations: stationsArray.length,
      stations: stationsArray,
      routeCoords,   // [[lat, lon], ...] for map polyline
      warnings
    });

  } catch (error) {
    console.error("ROUTE ERROR:", error.message);
    res.status(500).json({
      error: "Something went wrong — please retry",
      details: error.message
    });
  }
});

module.exports = router;