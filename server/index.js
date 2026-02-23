const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= MONGODB ================= */
mongoose.connect("mongodb+srv://EV:lWjf6wci08IKxsMV@cluster0.7z0bvyk.mongodb.net/?appName=Cluster0")
.then(() => console.log("MongoDB connected"))
.catch(err => console.log(err));

/* ================= ROUTES ================= */
app.use("/api", require("./routes/stationRoutes"));

/* ================= TEST ================= */
app.get("/", (req, res) => {
  res.send("API running");
});

/* ================= SERVER ================= */
const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});