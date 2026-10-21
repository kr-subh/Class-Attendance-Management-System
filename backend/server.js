const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

// Load environment variables
dotenv.config();

const app = express();

// Connect to Database
connectDB();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes = require("./routes/auth.routes");
const subjectRoutes = require("./routes/subject.routes");
const attendanceRoutes = require("./routes/attendance.routes");

app.use("/api/auth", authRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/attendance", attendanceRoutes);

// Health Check Route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Class Attendance Management System API is running",
    timestamp: new Date().toISOString()
  });
});

// Port & Server Start
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
