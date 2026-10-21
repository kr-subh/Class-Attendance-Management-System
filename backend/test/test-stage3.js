const mongoose = require("mongoose");
const http = require("http");
const dotenv = require("dotenv");
const app = require("../server");
const User = require("../models/User");
const Subject = require("../models/Subject");
const Attendance = require("../models/Attendance");

dotenv.config();

function makeRequest(server, options, body = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: "127.0.0.1",
      port,
      path: options.path,
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runStage3Tests() {
  console.log("==========================================");
  console.log("🚀 STARTING STAGE 3 TESTS: SUBJECT & ATTENDANCE");
  console.log("==========================================\n");

  let server;

  try {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    console.log(`0. Test server listening on ephemeral port ${port}...\n`);

    // Clean up any old test data
    await User.deleteMany({ email: { $regex: /@stage3-test\.edu$/ } });
    await Subject.deleteMany({ code: { $regex: /^CS301-TEST/ } });
    await Attendance.deleteMany({});

    // 1. Setup Test Users: Admin, Assigned Teacher, Other Teacher, Student A, Student B, Student C
    console.log("1. Setting up test users...");
    const adminRes = await makeRequest(server, { path: "/api/auth/register", method: "POST" }, {
      name: "Super Admin", email: "admin@stage3-test.edu", password: "password123", role: "admin"
    });
    const adminToken = (await makeRequest(server, { path: "/api/auth/login", method: "POST" }, {
      email: "admin@stage3-test.edu", password: "password123"
    })).data.token;

    const teacherRes = await makeRequest(server, { path: "/api/auth/register", method: "POST" }, {
      name: "Dr. Raman", email: "raman@stage3-test.edu", password: "password123", role: "teacher", department: "CSE"
    });
    const teacherId = teacherRes.data.user.id;
    const teacherToken = (await makeRequest(server, { path: "/api/auth/login", method: "POST" }, {
      email: "raman@stage3-test.edu", password: "password123"
    })).data.token;

    const otherTeacherRes = await makeRequest(server, { path: "/api/auth/register", method: "POST" }, {
      name: "Prof. Gupta", email: "gupta@stage3-test.edu", password: "password123", role: "teacher", department: "EE"
    });
    const otherTeacherToken = (await makeRequest(server, { path: "/api/auth/login", method: "POST" }, {
      email: "gupta@stage3-test.edu", password: "password123"
    })).data.token;

    const studentARes = await makeRequest(server, { path: "/api/auth/register", method: "POST" }, {
      name: "Aakash Singh", email: "aakash@stage3-test.edu", password: "password123", role: "student", rollNo: "001"
    });
    const studentAId = studentARes.data.user.id;
    const studentAToken = (await makeRequest(server, { path: "/api/auth/login", method: "POST" }, {
      email: "aakash@stage3-test.edu", password: "password123"
    })).data.token;

    const studentBRes = await makeRequest(server, { path: "/api/auth/register", method: "POST" }, {
      name: "Bhavna Patel", email: "bhavna@stage3-test.edu", password: "password123", role: "student", rollNo: "002"
    });
    const studentBId = studentBRes.data.user.id;

    const studentCRes = await makeRequest(server, { path: "/api/auth/register", method: "POST" }, {
      name: "Chirag Joshi", email: "chirag@stage3-test.edu", password: "password123", role: "student", rollNo: "003"
    });
    const studentCId = studentCRes.data.user.id;

    console.log("   ✅ Users ready: Admin, Assigned Teacher, Other Teacher, 3 Students\n");

    // 2. Test Subject Creation (Admin only)
    console.log("2. Testing Subject Creation and Role Restrictions...");
    // Attempt with teacher token -> must be 403
    const teacherSubjectAttempt = await makeRequest(server, {
      path: "/api/subjects",
      method: "POST",
      headers: { Authorization: `Bearer ${teacherToken}` }
    }, { name: "Unauthorized Subject", code: "CS301-FAIL", teacher: teacherId });
    if (teacherSubjectAttempt.status !== 403) throw new Error("Teacher should not be allowed to create subjects!");

    // Attempt with admin token -> must be 201
    const createSubRes = await makeRequest(server, {
      path: "/api/subjects",
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      name: "Database Systems",
      code: "CS301-TEST1",
      teacher: teacherId,
      students: [studentAId]
    });
    if (createSubRes.status !== 201 || !createSubRes.data.subject) throw new Error("Admin subject creation failed!");
    const subjectId = createSubRes.data.subject._id;
    console.log(`   ✅ Subject Created by Admin: ${createSubRes.data.subject.name} (${createSubRes.data.subject.code})\n`);

    // 3. Test Student Enrollment & Duplicate Prevention
    console.log("3. Testing Student Enrollment in Subject...");
    const enrollRes = await makeRequest(server, {
      path: `/api/subjects/${subjectId}/enroll`,
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    }, { studentIds: [studentBId, studentCId] });
    if (enrollRes.status !== 200 || enrollRes.data.subject.students.length !== 3) {
      throw new Error("Student enrollment failed!");
    }
    // Attempt enrolling studentB again -> should maintain 3 (no duplicate entry)
    await makeRequest(server, {
      path: `/api/subjects/${subjectId}/enroll`,
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    }, { studentIds: [studentBId] });
    const subAfterDup = await Subject.findById(subjectId);
    if (subAfterDup.students.length !== 3) throw new Error("Duplicate student enrollment occurred!");
    console.log("   ✅ Students enrolled: 3 unique students enrolled (duplicate enrollments prevented)\n");

    // 4. Test Attendance Marking & Role Authorization
    console.log("4. Testing Attendance Marking & Authorization...");
    // 4a. Other unassigned teacher attempts to mark -> must be 403
    const unauthorizedMark = await makeRequest(server, {
      path: "/api/attendance/mark",
      method: "POST",
      headers: { Authorization: `Bearer ${otherTeacherToken}` }
    }, {
      subjectId,
      date: "2026-10-01",
      slot: 1,
      records: [{ studentId: studentAId, status: "present" }]
    });
    if (unauthorizedMark.status !== 403) throw new Error("Unassigned teacher should be forbidden from marking attendance!");

    // 4b. Assigned teacher marks attendance for Slot 1 -> 200
    const validMark = await makeRequest(server, {
      path: "/api/attendance/mark",
      method: "POST",
      headers: { Authorization: `Bearer ${teacherToken}` }
    }, {
      subjectId,
      date: "2026-10-01",
      slot: 1,
      records: [
        { studentId: studentAId, status: "present" },
        { studentId: studentBId, status: "absent" }
      ]
    });
    if (validMark.status !== 200 || validMark.data.count !== 2) throw new Error("Valid attendance marking failed!");
    console.log("   ✅ Attendance marked successfully by assigned teacher (Slot 1)\n");

    // 5. Test Duplicate Prevention & Attendance Editing
    console.log("5. Testing Duplicate Prevention and Attendance Editing (In-Place Update)...");
    const countBeforeEdit = await Attendance.countDocuments({ subject: subjectId });
    // Teacher edits studentB's status from 'absent' to 'present' for the same date and slot
    const editRes = await makeRequest(server, {
      path: "/api/attendance/mark",
      method: "POST",
      headers: { Authorization: `Bearer ${teacherToken}` }
    }, {
      subjectId,
      studentId: studentBId,
      date: "2026-10-01",
      slot: 1,
      status: "present"
    });
    const countAfterEdit = await Attendance.countDocuments({ subject: subjectId });
    if (countAfterEdit !== countBeforeEdit) {
      throw new Error("Attendance record was duplicated instead of updated in-place!");
    }
    const updatedRecord = await Attendance.findOne({
      subject: subjectId,
      student: studentBId,
      date: "2026-10-01",
      slot: 1
    });
    if (updatedRecord.status !== "present") throw new Error("Attendance status was not updated to 'present'!");
    console.log("   ✅ Attendance Edit Verified: Existing record updated in-place, NO duplicate created\n");

    // 6. Test Multiple Slots on Same Date (Consecutive Classes)
    console.log("6. Testing Multiple Class Slots on the Same Date (Slot 1 & Slot 2)...");
    const slot2Mark = await makeRequest(server, {
      path: "/api/attendance/mark",
      method: "POST",
      headers: { Authorization: `Bearer ${teacherToken}` }
    }, {
      subjectId,
      date: "2026-10-01",
      slot: 2, // Consecutive slot / Lab block
      records: [
        { studentId: studentAId, status: "present" },
        { studentId: studentBId, status: "absent" }
      ]
    });
    if (slot2Mark.status !== 200) throw new Error("Failed to mark attendance for Slot 2 on the same date!");
    const studentARecordsForDate = await Attendance.find({
      subject: subjectId,
      student: studentAId,
      date: "2026-10-01"
    });
    if (studentARecordsForDate.length !== 2) throw new Error("Both slot 1 and slot 2 records must exist for student on same date!");
    console.log(`   ✅ Multiple Slots Verified: Student has ${studentARecordsForDate.length} distinct slot records for 2026-10-01\n`);

    // 7. Seed 8 more classes to test percentage and 75% shortage calculation
    console.log("7. Testing Subject-wise Summaries and < 75% Shortage Calculation...");
    // Let's create classes for dates: 2026-10-02 through 2026-10-09 (8 more classes, total 10 classes)
    // Student A will attend all 8 classes -> Total 10, Attended 10 -> 100% (No shortage)
    // Student B will attend only 3 of these 8 -> Total 10, Attended: 1 (from slot 1 edit) + 0 (from slot 2) + 3 = 4 -> 40% (Shortage!)
    for (let d = 2; d <= 9; d++) {
      const dateStr = `2026-10-0${d}`;
      await makeRequest(server, {
        path: "/api/attendance/mark",
        method: "POST",
        headers: { Authorization: `Bearer ${teacherToken}` }
      }, {
        subjectId,
        date: dateStr,
        slot: 1,
        records: [
          { studentId: studentAId, status: "present" },
          { studentId: studentBId, status: d <= 4 ? "present" : "absent" } // 3 present (d=2,3,4)
        ]
      });
    }

    // Call summary endpoint
    const summaryRes = await makeRequest(server, {
      path: `/api/attendance/summary/subject/${subjectId}`,
      method: "GET",
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    if (summaryRes.status !== 200) throw new Error("Failed to fetch attendance summary!");

    const studentASummary = summaryRes.data.summary.find((s) => String(s.student.id) === studentAId);
    const studentBSummary = summaryRes.data.summary.find((s) => String(s.student.id) === studentBId);
    const studentCSummary = summaryRes.data.summary.find((s) => String(s.student.id) === studentCId);

    console.log(`   Student A: ${studentASummary.attendedClasses}/${studentASummary.totalClasses} (${studentASummary.percentage}%) - Shortage: ${studentASummary.isShortage} - Classes needed: ${studentASummary.classesNeededTo75}`);
    console.log(`   Student B: ${studentBSummary.attendedClasses}/${studentBSummary.totalClasses} (${studentBSummary.percentage}%) - Shortage: ${studentBSummary.isShortage} - Classes needed: ${studentBSummary.classesNeededTo75}`);
    console.log(`   Student C (0 classes marked): Total: ${studentCSummary.totalClasses} - Shortage: ${studentCSummary.isShortage} - Classes needed: ${studentCSummary.classesNeededTo75}`);

    // Verify Student A: 10/10 = 100%, isShortage = false, classesNeeded = 0
    if (studentASummary.percentage !== 100 || studentASummary.isShortage !== false || studentASummary.classesNeededTo75 !== 0) {
      throw new Error("Student A summary calculations incorrect!");
    }

    // Verify Student B: 4/10 = 40%, isShortage = true
    // Formula: 3*Total - 4*Attended = 3*10 - 4*4 = 30 - 16 = 14 classes needed!
    if (studentBSummary.percentage !== 40 || studentBSummary.isShortage !== true || studentBSummary.classesNeededTo75 !== 14) {
      throw new Error(`Student B calculations incorrect! Expected 14 classes needed, got ${studentBSummary.classesNeededTo75}`);
    }

    // Verify Student C (edge case: 0 classes attended)
    if (studentCSummary.classesNeededTo75 < 0) {
      throw new Error("Student C classesNeededTo75 must not be negative!");
    }
    console.log("   ✅ Summary Calculations Verified: Percentages, Shortage Flags, and Consecutive Classes to reach 75% accurate\n");

    // 8. Test Dedicated Shortage Filter Endpoint
    console.log("8. Testing Dedicated Shortage Endpoint (/api/attendance/shortage/subject/:id)...");
    const shortageRes = await makeRequest(server, {
      path: `/api/attendance/shortage/subject/${subjectId}`,
      method: "GET",
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    if (shortageRes.status !== 200 || shortageRes.data.shortageCount < 1) {
      throw new Error("Dedicated shortage endpoint failed!");
    }
    const hasStudentB = shortageRes.data.shortageStudents.some((s) => String(s.student.id) === studentBId);
    if (!hasStudentB) throw new Error("Student B not found in shortage report!");
    console.log(`   ✅ Shortage Endpoint: Returned ${shortageRes.data.shortageCount} student(s) below 75%\n`);

    // 9. Test Student's Personal Endpoint: GET /api/attendance/student/me
    console.log("9. Testing Student's Personal Attendance Dashboard (/api/attendance/student/me)...");
    const myAttendanceRes = await makeRequest(server, {
      path: "/api/attendance/student/me",
      method: "GET",
      headers: { Authorization: `Bearer ${studentAToken}` }
    });
    if (myAttendanceRes.status !== 200 || myAttendanceRes.data.reports.length === 0) {
      throw new Error("Student personal attendance report failed!");
    }
    const mySubReport = myAttendanceRes.data.reports[0];
    if (mySubReport.percentage !== 100 || mySubReport.isShortage !== false) {
      throw new Error("Student A personal report numbers mismatch!");
    }
    console.log(`   ✅ Student Personal Report: SUCCESS (${mySubReport.name} - ${mySubReport.percentage}%)\n`);

    // 10. Test Subject Deletion & Cascading Attendance Cleanup (Admin only)
    console.log("10. Testing Subject Deletion and Cascading Cleanup...");
    const delRes = await makeRequest(server, {
      path: `/api/subjects/${subjectId}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (delRes.status !== 200) throw new Error("Subject deletion failed!");
    const remainingAttendance = await Attendance.countDocuments({ subject: subjectId });
    if (remainingAttendance !== 0) throw new Error("Associated attendance records were not cleaned up after subject deletion!");
    console.log("   ✅ Subject and associated attendance records deleted cleanly\n");

    // 11. Cleanup test users
    console.log("11. Cleaning up test accounts from database...");
    await User.deleteMany({ email: { $regex: /@stage3-test\.edu$/ } });
    console.log("   ✅ Cleanup: SUCCESS\n");

    console.log("==========================================");
    console.log("🎉 ALL STAGE 3 TESTS PASSED WITH 100% SUCCESS!");
    console.log("==========================================");

    process.exit(0);
  } catch (error) {
    console.error("❌ STAGE 3 TEST RUNNER FAILED:", error);
    process.exit(1);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
}

runStage3Tests();
