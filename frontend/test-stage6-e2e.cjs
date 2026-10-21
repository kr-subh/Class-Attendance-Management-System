process.env.NODE_ENV = "test";
const http = require("http");
const jwt = require("../backend/node_modules/jsonwebtoken");
const app = require("../backend/server");

const testPort = 5001;

function makeRequest(path, method, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: "127.0.0.1",
      port: testPort,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
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

async function runStage6E2ETests() {
  console.log("================================================================");
  console.log("  STAGE 6 TEST SUITE: END-TO-END FLOWS, EDGE CASES & SECURITY   ");
  console.log("================================================================\n");

  let server;
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, testName) {
    totalCount++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      throw new Error(`Assertion failed for: ${testName}`);
    }
  }

  try {
    server = app.listen(testPort);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const timestamp = Date.now();
    const adminEmail = `e2e_admin_${timestamp}@attendance.test`;
    const teacher1Email = `e2e_prof1_${timestamp}@attendance.test`;
    const teacher2Email = `e2e_prof2_${timestamp}@attendance.test`;
    const student1Email = `e2e_stu1_${timestamp}@attendance.test`;
    const student2Email = `e2e_stu2_${timestamp}@attendance.test`;
    const password = "Password123!";

    // --- Section 1: User Registrations & Authentications ---
    console.log("--- Section 1: User Registrations & Authentications ---");
    const adminReg = await makeRequest("/api/auth/register", "POST", {
      name: "Dr. Admin Chief",
      email: adminEmail,
      password,
      role: "admin",
      department: "Administration"
    });
    assert(adminReg.status === 201, "Admin registered (201)");
    const adminLogin = await makeRequest("/api/auth/login", "POST", { email: adminEmail, password });
    assert(adminLogin.status === 200 && adminLogin.data.token, "Admin logged in with JWT");
    const adminToken = adminLogin.data.token;

    const teacher1Reg = await makeRequest("/api/auth/register", "POST", {
      name: "Prof. Primary Teacher",
      email: teacher1Email,
      password,
      role: "teacher",
      department: "Computer Science"
    });
    assert(teacher1Reg.status === 201, "Teacher 1 registered (201)");
    const teacher1Login = await makeRequest("/api/auth/login", "POST", { email: teacher1Email, password });
    assert(teacher1Login.status === 200, "Teacher 1 logged in with JWT");
    const teacher1Token = teacher1Login.data.token;
    const teacher1Id = teacher1Login.data.user.id;

    const teacher2Reg = await makeRequest("/api/auth/register", "POST", {
      name: "Prof. Secondary Teacher",
      email: teacher2Email,
      password,
      role: "teacher",
      department: "Electrical Eng"
    });
    assert(teacher2Reg.status === 201, "Teacher 2 registered (201)");
    const teacher2Login = await makeRequest("/api/auth/login", "POST", { email: teacher2Email, password });
    assert(teacher2Login.status === 200, "Teacher 2 logged in with JWT");
    const teacher2Token = teacher2Login.data.token;

    const stu1Reg = await makeRequest("/api/auth/register", "POST", {
      name: "Student One",
      email: student1Email,
      password,
      role: "student",
      rollNo: `ROLL-1-${timestamp.toString().slice(-4)}`,
      department: "Computer Science"
    });
    assert(stu1Reg.status === 201, "Student 1 registered (201)");
    const stu1Login = await makeRequest("/api/auth/login", "POST", { email: student1Email, password });
    assert(stu1Login.status === 200, "Student 1 logged in with JWT");
    const stu1Token = stu1Login.data.token;
    const stu1Id = stu1Login.data.user.id;

    const stu2Reg = await makeRequest("/api/auth/register", "POST", {
      name: "Student Two",
      email: student2Email,
      password,
      role: "student",
      rollNo: `ROLL-2-${timestamp.toString().slice(-4)}`,
      department: "Computer Science"
    });
    assert(stu2Reg.status === 201, "Student 2 registered (201)");
    const stu2Login = await makeRequest("/api/auth/login", "POST", { email: student2Email, password });
    assert(stu2Login.status === 200, "Student 2 logged in with JWT");
    const stu2Token = stu2Login.data.token;
    const stu2Id = stu2Login.data.user.id;

    // --- Section 2: Subject Management & Enrollment ---
    console.log("\n--- Section 2: Subject Management & Enrollment ---");
    const createSub = await makeRequest("/api/subjects", "POST", {
      name: "Automata & Computation",
      code: `CS${timestamp.toString().slice(-4)}`,
      teacher: teacher1Id
    }, adminToken);
    assert(createSub.status === 201, "Admin creates subject with assigned Teacher 1");
    const subject = createSub.data.subject;

    // Enroll students
    const enroll = await makeRequest(`/api/subjects/${subject._id}/enroll`, "POST", {
      studentIds: [stu1Id, stu2Id]
    }, adminToken);
    assert(enroll.status === 200 && enroll.data.subject.students.length === 2, "Admin enrolls Student 1 and Student 2");

    // --- Section 3: Attendance Marking, Multi-Slot & In-place Edit Verification ---
    console.log("\n--- Section 3: Attendance Marking, Multi-Slot & In-Place Editing ---");
    const testDate = "2026-10-25";

    // Mark Slot 1: Student 1 Present, Student 2 Absent
    const markSlot1 = await makeRequest("/api/attendance/mark", "POST", {
      subjectId: subject._id,
      date: testDate,
      slot: 1,
      records: [
        { studentId: stu1Id, status: "present" },
        { studentId: stu2Id, status: "absent" }
      ]
    }, teacher1Token);
    assert(markSlot1.status === 200 && markSlot1.data.records.length === 2, "Teacher 1 marks attendance for Slot 1");

    // Edit Slot 1: Change Student 2 from Absent to Present
    const editSlot1 = await makeRequest("/api/attendance/mark", "POST", {
      subjectId: subject._id,
      date: testDate,
      slot: 1,
      records: [
        { studentId: stu1Id, status: "present" },
        { studentId: stu2Id, status: "present" }
      ]
    }, teacher1Token);
    assert(editSlot1.status === 200, "Teacher 1 updates attendance for Slot 1 in-place");

    // Verify session record count is still exactly 2 (no duplicates)
    const checkRoster = await makeRequest(
      `/api/attendance/subject/${subject._id}?date=${testDate}&slot=1`,
      "GET",
      null,
      teacher1Token
    );
    assert(checkRoster.data.records.length === 2, "Duplicate prevention: total records remains 2");
    const stu2Rec = checkRoster.data.records.find((r) => (r.student._id || r.student) === stu2Id);
    assert(stu2Rec && stu2Rec.status === "present", "Student 2 record updated to 'present'");

    // Consecutive session on same date: Slot 2
    const markSlot2 = await makeRequest("/api/attendance/mark", "POST", {
      subjectId: subject._id,
      date: testDate,
      slot: 2,
      records: [
        { studentId: stu1Id, status: "present" },
        { studentId: stu2Id, status: "absent" }
      ]
    }, teacher1Token);
    assert(markSlot2.status === 200, "Consecutive slot (Slot 2) on same date recorded without conflict");

    // Add 2 more sessions on subsequent dates:
    // Session 3: Slot 1 (Stu 1 Present, Stu 2 Absent)
    await makeRequest("/api/attendance/mark", "POST", {
      subjectId: subject._id,
      date: "2026-10-26",
      slot: 1,
      records: [
        { studentId: stu1Id, status: "present" },
        { studentId: stu2Id, status: "absent" }
      ]
    }, teacher1Token);

    // Session 4: Slot 1 (Stu 1 Present, Stu 2 Absent)
    await makeRequest("/api/attendance/mark", "POST", {
      subjectId: subject._id,
      date: "2026-10-27",
      slot: 1,
      records: [
        { studentId: stu1Id, status: "present" },
        { studentId: stu2Id, status: "absent" }
      ]
    }, teacher1Token);

    // --- Section 4: Edge Cases & Mathematical Shortage Formula ---
    console.log("\n--- Section 4: Shortage & Consecutive Classes Formula Verification ---");
    // Classes held = 4
    // Student 1: 4 present, 0 absent = 100% -> shortage: false, needed: 0
    // Student 2: 1 present, 3 absent = 25% -> shortage: true, needed: max(0, 3*4 - 4*1) = 8
    const summaryRes = await makeRequest(`/api/attendance/summary/subject/${subject._id}`, "GET", null, teacher1Token);
    assert(summaryRes.data.totalSessions === 4, "Summary confirms 4 distinct sessions held");
    const stu1Summary = summaryRes.data.summary.find((s) => (s.student.id || s.student._id) === stu1Id);
    const stu2Summary = summaryRes.data.summary.find((s) => (s.student.id || s.student._id) === stu2Id);

    assert(stu1Summary.percentage === 100 && stu1Summary.isShortage === false && stu1Summary.classesNeededTo75 === 0, "Student 1 (100%): no shortage, 0 classes needed");
    assert(stu2Summary.percentage === 25 && stu2Summary.isShortage === true && stu2Summary.classesNeededTo75 === 8, "Student 2 (25%): shortage flagged, exactly 8 consecutive classes needed");

    // --- Section 5: Security, Token Expiry, and Error Edge Cases ---
    console.log("\n--- Section 5: Security, Token Expiry, and Error Edge Cases ---");

    // 5.1 Empty records array validation
    const emptyMarkRes = await makeRequest("/api/attendance/mark", "POST", {
      subjectId: subject._id,
      date: testDate,
      slot: 1,
      records: []
    }, teacher1Token);
    assert(emptyMarkRes.status === 400, "Empty attendance records rejected with 400 Bad Request");

    // 5.2 Teacher 2 cannot mark attendance for Teacher 1's subject
    const unauthTeacherMark = await makeRequest("/api/attendance/mark", "POST", {
      subjectId: subject._id,
      date: testDate,
      slot: 1,
      records: [{ studentId: stu1Id, status: "present" }]
    }, teacher2Token);
    assert(unauthTeacherMark.status === 403, "Teacher cannot mark attendance for non-assigned subject (403)");

    // 5.3 Student cannot mark attendance
    const studentMarkRes = await makeRequest("/api/attendance/mark", "POST", {
      subjectId: subject._id,
      date: testDate,
      slot: 1,
      records: [{ studentId: stu1Id, status: "present" }]
    }, stu1Token);
    assert(studentMarkRes.status === 403, "Student cannot mark attendance (403)");

    // 5.4 Missing token
    const missingTokenRes = await makeRequest("/api/attendance/student/me", "GET");
    assert(missingTokenRes.status === 401, "Request without token rejected with 401 Unauthorized");

    // 5.5 Invalid token
    const invalidTokenRes = await makeRequest("/api/attendance/student/me", "GET", null, "invalid.jwt.token");
    assert(invalidTokenRes.status === 401, "Malformed token rejected with 401 Unauthorized");

    // 5.6 Expired token simulation
    const secret = process.env.JWT_SECRET || "supersecretjwtkey_attendance_system_2026";
    const expiredToken = jwt.sign(
      { userId: stu1Id, role: "student" },
      secret,
      { expiresIn: "1ms" } // Expired immediately
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    const expiredTokenRes = await makeRequest("/api/attendance/student/me", "GET", null, expiredToken);
    assert(expiredTokenRes.status === 401, "Expired token rejected with 401 Unauthorized");

    // 5.7 Non-existent subject 404
    const notFoundSubRes = await makeRequest("/api/subjects/652f1e29d71b3e819a8264bc", "GET", null, adminToken);
    assert(notFoundSubRes.status === 404, "Non-existent subject ID returns 404 Not Found");

    // --- Section 6: Student Dashboard Personal API Contract ---
    console.log("\n--- Section 6: Student Dashboard Personal API Contract ---");
    const stu1Me = await makeRequest("/api/attendance/student/me", "GET", null, stu1Token);
    assert(stu1Me.status === 200 && stu1Me.data.reports.length === 1, "Student 1 retrieves personal attendance report");
    assert(stu1Me.data.reports[0].history.length === 4, "Student 1 history includes all 4 class sessions");

    const stu2Me = await makeRequest("/api/attendance/student/me", "GET", null, stu2Token);
    assert(stu2Me.status === 200 && stu2Me.data.reports[0].isShortage === true, "Student 2 personal report flags shortage (<75%)");
    assert(stu2Me.data.reports[0].classesNeededTo75 === 8, "Student 2 personal report displays 8 consecutive classes needed");

    console.log("\n================================================================");
    console.log(`  ALL ${passedCount}/${totalCount} E2E & EDGE CASE TESTS PASSED SUCCESSFULLY!  `);
    console.log("================================================================\n");
    process.exit(0);
  } catch (error) {
    console.error("Stage 6 Test Suite Failed:", error);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runStage6E2ETests();
