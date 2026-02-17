const express = require("express");
const connectDB = require("./config/db");



const app = express();

// Connect to database
connectDB();

// Middleware to parse JSON
app.use(express.json());


// Routes
app.use("/api", require("./routes/stationRoutes"));

// Test route
app.get("/", (req, res) => {
  res.send("EV Charging API running");
});

// Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
