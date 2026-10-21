const express = require("express");
const Subject = require("../models/Subject");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

/**
 * @route   GET /api/subjects
 * @desc    Get subjects (Admin: all, Teacher: assigned, Student: enrolled)
 * @access  Private (All authenticated users)
 */
router.get("/", auth, async (req, res) => {
  try {
    let query = {};

    if (req.user.role === "teacher") {
      query = { teacher: req.user.userId };
    } else if (req.user.role === "student") {
      query = { students: req.user.userId };
    }
    // Admin sees all subjects (query is empty {})

    const subjects = await Subject.find(query)
      .populate("teacher", "name email department")
      .populate("students", "name email rollNo department")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: subjects.length,
      subjects
    });
  } catch (error) {
    console.error("Get Subjects Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error fetching subjects.",
      error: error.message
    });
  }
});

/**
 * @route   GET /api/subjects/:id
 * @desc    Get single subject details
 * @access  Private
 */
router.get("/:id", auth, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id)
      .populate("teacher", "name email department")
      .populate("students", "name email rollNo department");

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found."
      });
    }

    // Role check: student can only view if enrolled, teacher only if assigned, admin can view all
    if (req.user.role === "teacher" && String(subject.teacher._id) !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not assigned to this subject."
      });
    }

    if (
      req.user.role === "student" &&
      !subject.students.some((s) => String(s._id) === req.user.userId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not enrolled in this subject."
      });
    }

    return res.status(200).json({
      success: true,
      subject
    });
  } catch (error) {
    console.error("Get Subject By ID Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error fetching subject details.",
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subjects
 * @desc    Create a new subject
 * @access  Private (Admin only)
 */
router.post("/", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const { name, code, teacher, students } = req.body;

    if (!name || !code || !teacher) {
      return res.status(400).json({
        success: false,
        message: "Please provide subject name, code, and assigned teacher ID."
      });
    }

    // Check if code is already in use
    const normalizedCode = code.toUpperCase().trim();
    const existingSubject = await Subject.findOne({ code: normalizedCode });
    if (existingSubject) {
      return res.status(400).json({
        success: false,
        message: "Subject with this course code already exists."
      });
    }

    // Verify teacher exists and has 'teacher' role
    const teacherUser = await User.findById(teacher);
    if (!teacherUser || teacherUser.role !== "teacher") {
      return res.status(400).json({
        success: false,
        message: "Invalid teacher ID. User does not exist or does not have teacher role."
      });
    }

    const subject = await Subject.create({
      name: name.trim(),
      code: normalizedCode,
      teacher,
      students: Array.isArray(students) ? students : []
    });

    const populatedSubject = await Subject.findById(subject._id)
      .populate("teacher", "name email department")
      .populate("students", "name email rollNo");

    return res.status(201).json({
      success: true,
      message: "Subject created successfully.",
      subject: populatedSubject
    });
  } catch (error) {
    console.error("Create Subject Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error creating subject.",
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/subjects/:id
 * @desc    Update subject details or assigned teacher
 * @access  Private (Admin only)
 */
router.put("/:id", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const { name, code, teacher } = req.body;
    const updateData = {};

    if (name) updateData.name = name.trim();
    if (code) updateData.code = code.toUpperCase().trim();

    if (teacher) {
      const teacherUser = await User.findById(teacher);
      if (!teacherUser || teacherUser.role !== "teacher") {
        return res.status(400).json({
          success: false,
          message: "Invalid teacher ID. User must have teacher role."
        });
      }
      updateData.teacher = teacher;
    }

    const updatedSubject = await Subject.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("teacher", "name email department")
      .populate("students", "name email rollNo");

    if (!updatedSubject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subject updated successfully.",
      subject: updatedSubject
    });
  } catch (error) {
    console.error("Update Subject Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error updating subject.",
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/subjects/:id
 * @desc    Delete subject and its attendance history
 * @access  Private (Admin only)
 */
router.delete("/:id", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found."
      });
    }

    // Delete related attendance records
    await Attendance.deleteMany({ subject: subject._id });

    // Delete subject
    await Subject.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Subject and related attendance records deleted successfully."
    });
  } catch (error) {
    console.error("Delete Subject Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error deleting subject.",
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subjects/:id/enroll
 * @desc    Enroll students into subject
 * @access  Private (Admin only)
 */
router.post("/:id/enroll", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const { studentIds } = req.body;

    if (!studentIds || (!Array.isArray(studentIds) && typeof studentIds !== "string")) {
      return res.status(400).json({
        success: false,
        message: "Please provide studentIds as an array or single ID string."
      });
    }

    const idsToAdd = Array.isArray(studentIds) ? studentIds : [studentIds];

    // Use $addToSet to prevent duplicate enrollment
    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { students: { $each: idsToAdd } } },
      { new: true }
    )
      .populate("teacher", "name email department")
      .populate("students", "name email rollNo");

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Students enrolled successfully.",
      subject
    });
  } catch (error) {
    console.error("Enroll Students Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error enrolling students.",
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subjects/:id/unenroll
 * @desc    Unenroll a student from subject
 * @access  Private (Admin only)
 */
router.post("/:id/unenroll", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Please provide studentId to unenroll."
      });
    }

    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { $pull: { students: studentId } },
      { new: true }
    )
      .populate("teacher", "name email department")
      .populate("students", "name email rollNo");

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student unenrolled successfully.",
      subject
    });
  } catch (error) {
    console.error("Unenroll Student Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error unenrolling student.",
      error: error.message
    });
  }
});

module.exports = router;
