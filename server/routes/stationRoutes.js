const express = require("express");
const router = express.Router();

router.get("/stations", (req, res) => {
  res.json([
    {
      name: "Sample EV Station",
      latitude: 12.91,
      longitude: 77.60,
      chargerType: "Fast",
    },
  ]);
});

module.exports = router;
