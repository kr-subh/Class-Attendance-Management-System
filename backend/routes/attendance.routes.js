const express = require("express");
const Attendance = require("../models/Attendance");
const Subject = require("../models/Subject");
const User = require("../models/User");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

/**
 * Helper: Calculate classes needed to reach 75% attendance
 * Formula derivation:
 * (Attended + C) / (Total + C) >= 0.75
 * 4(Attended + C) >= 3(Total + C)
 * 4*Attended + 4C >= 3*Total + 3C
 * C >= 3*Total - 4*Attended
 */
function calculateClassesNeededTo75(total, attended) {
  if (total <= 0) return 0;
  const currentPercentage = (attended / total) * 100;
  if (currentPercentage >= 75) return 0;
  return Math.max(0, 3 * total - 4 * attended);
}

/**
 * @route   POST /api/attendance/mark
 * @desc    Mark or edit attendance records (handles single & batch, prevents duplicates, supports slots)
 * @access  Private (Teacher or Admin)
 */
router.post("/mark", auth, authorizeRoles("teacher", "admin"), async (req, res) => {
  try {
    const { subjectId, date, slot = 1, records, studentId, status } = req.body;

    if (!subjectId || !date) {
      return res.status(400).json({
        success: false,
        message: "Please provide subjectId and date (YYYY-MM-DD)."
      });
    }

    // Verify subject exists
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found."
      });
    }

    // Authorization check: Teacher can only mark attendance for their own subject
    if (req.user.role === "teacher" && String(subject.teacher) !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are only allowed to mark attendance for your assigned subjects."
      });
    }

    const slotNumber = Number(slot) || 1;
    const dateStr = String(date).trim();

    // Prepare list of items to mark
    let itemsToProcess = [];

    if (Array.isArray(records) && records.length > 0) {
      itemsToProcess = records.map((r) => ({
        studentId: r.studentId,
        status: String(r.status).toLowerCase() === "present" ? "present" : "absent"
      }));
    } else if (studentId && status) {
      itemsToProcess = [
        {
          studentId,
          status: String(status).toLowerCase() === "present" ? "present" : "absent"
        }
      ];
    } else {
      return res.status(400).json({
        success: false,
        message: "Please provide attendance records array [{ studentId, status }] or single studentId and status."
      });
    }

    const processedResults = [];

    // Process each student record using findOneAndUpdate with upsert
    // This updates existing record if already marked, or inserts a new one, avoiding duplicates
    for (const item of itemsToProcess) {
      const updatedRecord = await Attendance.findOneAndUpdate(
        {
          student: item.studentId,
          subject: subjectId,
          date: dateStr,
          slot: slotNumber
        },
        {
          status: item.status,
          markedBy: req.user.userId
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      );
      processedResults.push(updatedRecord);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully marked attendance for ${processedResults.length} student(s).`,
      count: processedResults.length,
      records: processedResults
    });
  } catch (error) {
    console.error("Mark Attendance Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error marking attendance.",
      error: error.message
    });
  }
});

/**
 * @route   GET /api/attendance/subject/:subjectId
 * @desc    Get attendance records for a subject (optionally filter by date and slot)
 * @access  Private (Teacher, Admin, or enrolled Student)
 */
router.get("/subject/:subjectId", auth, async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { date, slot } = req.query;

    const query = { subject: subjectId };
    if (date) query.date = date;
    if (slot) query.slot = Number(slot);

    const records = await Attendance.find(query)
      .populate("student", "name email rollNo")
      .populate("markedBy", "name email")
      .sort({ date: -1, slot: 1 });

    return res.status(200).json({
      success: true,
      count: records.length,
      records
    });
  } catch (error) {
    console.error("Get Subject Attendance Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error fetching attendance records.",
      error: error.message
    });
  }
});

/**
 * @route   GET /api/attendance/summary/subject/:subjectId
 * @desc    Get complete attendance summary, percentages, and shortage report for a subject
 * @access  Private (Teacher, Admin, or enrolled Student)
 */
router.get("/summary/subject/:subjectId", auth, async (req, res) => {
  try {
    const { subjectId } = req.params;

    const subject = await Subject.findById(subjectId)
      .populate("teacher", "name email department")
      .populate("students", "name email rollNo department");

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found."
      });
    }

    // Role verification
    if (req.user.role === "teacher" && String(subject.teacher._id) !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not assigned to this subject."
      });
    }

    // Fetch all attendance records for this subject
    const allRecords = await Attendance.find({ subject: subjectId })
      .populate("student", "name email rollNo")
      .sort({ date: 1, slot: 1 });

    // Determine total distinct class sessions held: unique (date + slot) combinations
    const sessionSet = new Set();
    allRecords.forEach((r) => {
      sessionSet.add(`${r.date}__slot${r.slot}`);
    });
    const totalSessions = sessionSet.size;

    // Student-wise computation
    const studentSummaries = subject.students.map((student) => {
      const studentRecords = allRecords.filter(
        (r) => String(r.student._id || r.student) === String(student._id)
      );

      const attended = studentRecords.filter((r) => r.status === "present").length;
      const absent = studentRecords.filter((r) => r.status === "absent").length;
      const totalRecorded = studentRecords.length;

      // Use totalRecorded or totalSessions (both match when all students are marked)
      const effectiveTotal = Math.max(totalRecorded, totalSessions);

      const percentage =
        effectiveTotal === 0 ? 0 : Math.round((attended / effectiveTotal) * 100);

      const isShortage = effectiveTotal > 0 && percentage < 75;
      const classesNeededTo75 = calculateClassesNeededTo75(effectiveTotal, attended);

      return {
        student: {
          id: student._id,
          name: student.name,
          email: student.email,
          rollNo: student.rollNo,
          department: student.department
        },
        totalClasses: effectiveTotal,
        attendedClasses: attended,
        absentClasses: absent,
        percentage,
        isShortage,
        classesNeededTo75,
        history: studentRecords.map((r) => ({
          date: r.date,
          slot: r.slot,
          status: r.status
        }))
      };
    });

    const shortageCount = studentSummaries.filter((s) => s.isShortage).length;

    return res.status(200).json({
      success: true,
      subject: {
        id: subject._id,
        name: subject.name,
        code: subject.code,
        teacher: subject.teacher,
        enrolledCount: subject.students.length
      },
      totalSessions,
      shortageCount,
      summary: studentSummaries
    });
  } catch (error) {
    console.error("Get Attendance Summary Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error generating attendance summary.",
      error: error.message
    });
  }
});

/**
 * @route   GET /api/attendance/shortage/subject/:subjectId
 * @desc    Get only students with attendance shortage below 75% for a subject
 * @access  Private (Teacher or Admin)
 */
router.get("/shortage/subject/:subjectId", auth, authorizeRoles("teacher", "admin"), async (req, res) => {
  try {
    const { subjectId } = req.params;

    const subject = await Subject.findById(subjectId)
      .populate("teacher", "name email department")
      .populate("students", "name email rollNo department");

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found."
      });
    }

    const allRecords = await Attendance.find({ subject: subjectId });

    // Distinct class sessions held
    const sessionSet = new Set();
    allRecords.forEach((r) => sessionSet.add(`${r.date}__slot${r.slot}`));
    const totalSessions = sessionSet.size;

    const shortageStudents = [];

    subject.students.forEach((student) => {
      const studentRecords = allRecords.filter(
        (r) => String(r.student) === String(student._id)
      );
      const attended = studentRecords.filter((r) => r.status === "present").length;
      const effectiveTotal = Math.max(studentRecords.length, totalSessions);

      const percentage =
        effectiveTotal === 0 ? 0 : Math.round((attended / effectiveTotal) * 100);

      if (effectiveTotal > 0 && percentage < 75) {
        shortageStudents.push({
          student: {
            id: student._id,
            name: student.name,
            email: student.email,
            rollNo: student.rollNo
          },
          totalClasses: effectiveTotal,
          attendedClasses: attended,
          percentage,
          classesNeededTo75: calculateClassesNeededTo75(effectiveTotal, attended)
        });
      }
    });

    return res.status(200).json({
      success: true,
      subject: {
        id: subject._id,
        name: subject.name,
        code: subject.code
      },
      shortageCount: shortageStudents.length,
      shortageStudents
    });
  } catch (error) {
    console.error("Get Shortage Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error calculating attendance shortage.",
      error: error.message
    });
  }
});

/**
 * @route   GET /api/attendance/student/me
 * @desc    Get attendance summary for the currently logged-in student across all enrolled subjects
 * @access  Private (Student)
 */
router.get("/student/me", auth, authorizeRoles("student"), async (req, res) => {
  try {
    const studentId = req.user.userId;

    // Find all subjects this student is enrolled in
    const enrolledSubjects = await Subject.find({ students: studentId })
      .populate("teacher", "name email department");

    const reports = [];

    for (const sub of enrolledSubjects) {
      const records = await Attendance.find({
        subject: sub._id,
        student: studentId
      }).sort({ date: 1, slot: 1 });

      const attended = records.filter((r) => r.status === "present").length;
      const totalClasses = records.length;
      const percentage =
        totalClasses === 0 ? 0 : Math.round((attended / totalClasses) * 100);

      const isShortage = totalClasses > 0 && percentage < 75;
      const classesNeededTo75 = calculateClassesNeededTo75(totalClasses, attended);

      reports.push({
        subjectId: sub._id,
        name: sub.name,
        code: sub.code,
        teacher: sub.teacher,
        totalClasses,
        attendedClasses: attended,
        percentage,
        isShortage,
        classesNeededTo75,
        history: records.map((r) => ({
          date: r.date,
          slot: r.slot,
          status: r.status
        }))
      });
    }

    return res.status(200).json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    console.error("Get Student Attendance Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error fetching student attendance history.",
      error: error.message
    });
  }
});

module.exports = router;
