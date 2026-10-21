const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Subject = require("../models/Subject");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (Admin, Teacher, Student)
 * @access  Public
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, rollNo, department } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long."
      });
    }

    // Check if email already exists
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists."
      });
    }

    // Validate role if provided
    const validRoles = ["admin", "teacher", "student"];
    const userRole = role && validRoles.includes(role.toLowerCase()) ? role.toLowerCase() : "student";

    // Hash password using bcrypt (salt rounds = 10 as in reference notes)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user record
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: userRole,
      rollNo: rollNo ? rollNo.trim() : "",
      department: department ? department.trim() : "Computer Science"
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNo: user.rollNo,
        department: user.department
      }
    });
  } catch (error) {
    console.error("Register Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error during registration.",
      error: error.message
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & return JWT token
 * @access  Public
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide both email and password."
      });
    }

    // Find user by normalized email
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    // Verify password with bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    // Create and sign JWT Token
    const secret = process.env.JWT_SECRET || "supersecretjwtkey_attendance_system_2026";
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        name: user.name
      },
      secret,
      {
        expiresIn: "1d" // 24 hours
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNo: user.rollNo,
        department: user.department
      }
    });
  } catch (error) {
    console.error("Login Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error during login.",
      error: error.message
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user details
 * @access  Private (Authenticated)
 */
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error("Get /me Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error fetching user profile.",
      error: error.message
    });
  }
});

/**
 * @route   GET /api/auth/users
 * @desc    Get users list (optionally filter by role: teacher or student)
 * @access  Private (Admin only)
 */
router.get("/users", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const { role } = req.query;
    const query = {};
    if (role) {
      query.role = role.toLowerCase();
    }
    const users = await User.find(query).select("-password").sort({ name: 1 });
    return res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error("Get Users Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error fetching users.",
      error: error.message
    });
  }
});

/**
 * @route   GET /api/auth/stats
 * @desc    Get system counts (students, teachers, subjects) for Admin Dashboard
 * @access  Private (Admin only)
 */
router.get("/stats", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const studentCount = await User.countDocuments({ role: "student" });
    const teacherCount = await User.countDocuments({ role: "teacher" });
    const subjectCount = await Subject.countDocuments();
    return res.status(200).json({
      success: true,
      stats: {
        studentCount,
        teacherCount,
        subjectCount
      }
    });
  } catch (error) {
    console.error("Get Stats Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error fetching stats.",
      error: error.message
    });
  }
});

module.exports = router;
