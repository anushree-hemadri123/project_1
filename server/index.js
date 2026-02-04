const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("EV Charging Station Locator API is running");
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
