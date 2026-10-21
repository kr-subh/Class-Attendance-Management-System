const express = require("express");
const Subject = require("../models/Subject");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

// Helper to populate teacher and student details
const populateSubject = (query) =>
  query.populate("teacher", "name email department").populate("students", "name email rollNo department");

/**
 * @route   GET /api/subjects
 * @desc    Get subjects (Admin: all, Teacher: assigned, Student: enrolled)
 */
router.get("/", auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "teacher") {
      query = { teacher: req.user.userId };
    } else if (req.user.role === "student") {
      query = { students: req.user.userId };
    }

    const subjects = await populateSubject(Subject.find(query).sort({ createdAt: -1 }));
    return res.status(200).json({ success: true, count: subjects.length, subjects });
  } catch (error) {
    console.error("Get Subjects Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error fetching subjects." });
  }
});

/**
 * @route   GET /api/subjects/:id
 * @desc    Get single subject details
 */
router.get("/:id", auth, async (req, res) => {
  try {
    const subject = await populateSubject(Subject.findById(req.params.id));
    if (!subject) {
      return res.status(404).json({ success: false, message: "Subject not found." });
    }

    if (req.user.role === "teacher" && String(subject.teacher._id) !== req.user.userId) {
      return res.status(403).json({ success: false, message: "Forbidden: You are not assigned to this subject." });
    }

    if (req.user.role === "student" && !subject.students.some((s) => String(s._id) === req.user.userId)) {
      return res.status(403).json({ success: false, message: "Forbidden: You are not enrolled in this subject." });
    }

    return res.status(200).json({ success: true, subject });
  } catch (error) {
    console.error("Get Subject Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error fetching subject details." });
  }
});

/**
 * @route   POST /api/subjects
 * @desc    Create a new subject
 */
router.post("/", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const { name, code, teacher, students } = req.body;
    if (!name || !code || !teacher) {
      return res.status(400).json({ success: false, message: "Please provide subject name, code, and assigned teacher ID." });
    }

    const normalizedCode = code.toUpperCase().trim();
    const existing = await Subject.findOne({ code: normalizedCode });
    if (existing) {
      return res.status(400).json({ success: false, message: "Subject with this course code already exists." });
    }

    const teacherUser = await User.findById(teacher);
    if (!teacherUser || teacherUser.role !== "teacher") {
      return res.status(400).json({ success: false, message: "Invalid teacher ID. User must have teacher role." });
    }

    const newSubject = await Subject.create({
      name: name.trim(),
      code: normalizedCode,
      teacher,
      students: Array.isArray(students) ? students : []
    });

    const subject = await populateSubject(Subject.findById(newSubject._id));
    return res.status(201).json({ success: true, message: "Subject created successfully.", subject });
  } catch (error) {
    console.error("Create Subject Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error creating subject." });
  }
});

/**
 * @route   PUT /api/subjects/:id
 * @desc    Update subject details or assigned teacher
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
        return res.status(400).json({ success: false, message: "Invalid teacher ID. User must have teacher role." });
      }
      updateData.teacher = teacher;
    }

    const subject = await populateSubject(
      Subject.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
    );

    if (!subject) {
      return res.status(404).json({ success: false, message: "Subject not found." });
    }

    return res.status(200).json({ success: true, message: "Subject updated successfully.", subject });
  } catch (error) {
    console.error("Update Subject Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error updating subject." });
  }
});

/**
 * @route   DELETE /api/subjects/:id
 * @desc    Delete subject and its attendance records
 */
router.delete("/:id", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: "Subject not found." });
    }

    await Attendance.deleteMany({ subject: subject._id });
    await Subject.findByIdAndDelete(req.params.id);

    return res.status(200).json({ success: true, message: "Subject and related attendance records deleted successfully." });
  } catch (error) {
    console.error("Delete Subject Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error deleting subject." });
  }
});

/**
 * @route   POST /api/subjects/:id/enroll
 * @desc    Enroll students into subject
 */
router.post("/:id/enroll", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const { studentIds } = req.body;
    if (!studentIds) {
      return res.status(400).json({ success: false, message: "Please provide studentIds to enroll." });
    }

    const idsToAdd = Array.isArray(studentIds) ? studentIds : [studentIds];
    const subject = await populateSubject(
      Subject.findByIdAndUpdate(req.params.id, { $addToSet: { students: { $each: idsToAdd } } }, { new: true })
    );

    if (!subject) {
      return res.status(404).json({ success: false, message: "Subject not found." });
    }

    return res.status(200).json({ success: true, message: "Students enrolled successfully.", subject });
  } catch (error) {
    console.error("Enroll Students Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error enrolling students." });
  }
});

/**
 * @route   POST /api/subjects/:id/unenroll
 * @desc    Unenroll a student from subject
 */
router.post("/:id/unenroll", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ success: false, message: "Please provide studentId to unenroll." });
    }

    const subject = await populateSubject(
      Subject.findByIdAndUpdate(req.params.id, { $pull: { students: studentId } }, { new: true })
    );

    if (!subject) {
      return res.status(404).json({ success: false, message: "Subject not found." });
    }

    return res.status(200).json({ success: true, message: "Student unenrolled successfully.", subject });
  } catch (error) {
    console.error("Unenroll Student Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error unenrolling student." });
  }
});

module.exports = router;
