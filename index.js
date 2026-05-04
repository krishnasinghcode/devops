const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

// Use an environment variable to distinguish blue vs green
const APP_VERSION = process.env.APP_VERSION || "unknown";

app.get("/", (req, res) => {
  res.send(`Hello from Lab CI/CD app! Environment: ${APP_VERSION}`);
});

app.listen(port, () => {
  console.log(`App listening on port ${port}, version ${APP_VERSION}`);
});