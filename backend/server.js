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

// Root Welcome Route
app.get("/", (req, res) => {
  res.send(`
    <div style="font-family: system-ui, sans-serif; text-align: center; padding: 50px 20px; line-height: 1.6;">
      <h2 style="color: #1e293b;">🎓 Class Attendance Management System API</h2>
      <p style="color: #16a34a; font-weight: 600; font-size: 1.1rem;">
        ✅ Backend API is running & connected to MongoDB Atlas!
      </p>
      <div style="margin-top: 30px;">
        <p style="color: #64748b; margin-bottom: 15px;">To view the application website and log in, open:</p>
        <a href="http://localhost:5173" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Open Frontend (http://localhost:5173) ➜
        </a>
      </div>
    </div>
  `);
});

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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
