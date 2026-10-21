process.env.NODE_ENV = "test";
const http = require("http");
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

async function runStage5Tests() {
  console.log("==================================================");
  console.log("  STAGE 5 TEST SUITE: DASHBOARDS & UI FEATURES    ");
  console.log("==================================================\n");

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
    // Start test server
    server = app.listen(testPort);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const timestamp = Date.now();
    const adminEmail = `stage5_admin_${timestamp}@attendance.test`;
    const teacherEmail = `stage5_prof_${timestamp}@attendance.test`;
    const student1Email = `stage5_stu1_${timestamp}@attendance.test`;
    const student2Email = `stage5_stu2_${timestamp}@attendance.test`;
    const password = "Password123!";

    // 1. Setup Accounts
    console.log("[Setup] Registering and logging in test accounts for Admin, Teacher, and 2 Students...");
    const adminReg = await makeRequest("/api/auth/register", "POST", {
      name: "Dr. Stage5 Admin",
      email: adminEmail,
      password,
      role: "admin",
      department: "Computer Science"
    });
    assert(adminReg.status === 201 && adminReg.data.user, "Admin registered successfully");
    const adminLogin = await makeRequest("/api/auth/login", "POST", { email: adminEmail, password });
    assert(adminLogin.status === 200 && adminLogin.data.token, "Admin logged in and received token");
    const adminToken = adminLogin.data.token;
    const adminUser = adminLogin.data.user;

    const teacherReg = await makeRequest("/api/auth/register", "POST", {
      name: "Prof. Stage5 Turing",
      email: teacherEmail,
      password,
      role: "teacher",
      department: "Computer Science"
    });
    assert(teacherReg.status === 201 && teacherReg.data.user, "Teacher registered successfully");
    const teacherLogin = await makeRequest("/api/auth/login", "POST", { email: teacherEmail, password });
    assert(teacherLogin.status === 200 && teacherLogin.data.token, "Teacher logged in and received token");
    const teacherToken = teacherLogin.data.token;
    const teacherUser = teacherLogin.data.user;

    const stu1Reg = await makeRequest("/api/auth/register", "POST", {
      name: "Student Alpha",
      email: student1Email,
      password,
      role: "student",
      rollNo: `CS-A-${timestamp.toString().slice(-4)}`,
      department: "Computer Science"
    });
    assert(stu1Reg.status === 201 && stu1Reg.data.user, "Student 1 registered successfully");
    const stu1Login = await makeRequest("/api/auth/login", "POST", { email: student1Email, password });
    assert(stu1Login.status === 200 && stu1Login.data.token, "Student 1 logged in and received token");
    const student1Token = stu1Login.data.token;
    const student1User = stu1Login.data.user;

    const stu2Reg = await makeRequest("/api/auth/register", "POST", {
      name: "Student Beta",
      email: student2Email,
      password,
      role: "student",
      rollNo: `CS-B-${timestamp.toString().slice(-4)}`,
      department: "Computer Science"
    });
    assert(stu2Reg.status === 201 && stu2Reg.data.user, "Student 2 registered successfully");
    const stu2Login = await makeRequest("/api/auth/login", "POST", { email: student2Email, password });
    assert(stu2Login.status === 200 && stu2Login.data.token, "Student 2 logged in and received token");
    const student2Token = stu2Login.data.token;
    const student2User = stu2Login.data.user;

    // ----------------------------------------------------
    // Section 1: Admin Dashboard Features
    // ----------------------------------------------------
    console.log("\n--- Section 1: Admin Dashboard Features ---");

    // 1.1 Real Stats
    const statsRes = await makeRequest("/api/auth/stats", "GET", null, adminToken);
    assert(statsRes.status === 200 && statsRes.data.success, "Admin stats retrieved successfully");
    assert(
      statsRes.data.stats.studentCount >= 2 &&
      statsRes.data.stats.teacherCount >= 1 &&
      typeof statsRes.data.stats.subjectCount === "number",
      "Stats contain real counts for students, teachers, and subjects"
    );

    // 1.2 Create Subject
    const subCode = `CS5${timestamp.toString().slice(-3)}`;
    const teacherId = teacherUser.id || teacherUser._id;
    const stu1Id = student1User.id || student1User._id;
    const stu2Id = student2User.id || student2User._id;

    const createSubRes = await makeRequest("/api/subjects", "POST", {
      name: "Operating Systems Architecture",
      code: subCode,
      teacher: teacherId
    }, adminToken);
    if (createSubRes.status !== 201) {
      console.log("createSubRes failed:", JSON.stringify(createSubRes));
    }
    assert(createSubRes.status === 201 && createSubRes.data.subject._id, "Admin creates subject with assigned teacher");
    let subject = createSubRes.data.subject;

    // 1.3 Edit Subject
    const editSubRes = await makeRequest(`/api/subjects/${subject._id}`, "PUT", {
      name: "Advanced Operating Systems",
      teacher: teacherId
    }, adminToken);
    assert(editSubRes.status === 200 && editSubRes.data.subject.name === "Advanced Operating Systems", "Admin edits subject name and teacher");

    // 1.4 Enroll Students
    const enrollRes = await makeRequest(`/api/subjects/${subject._id}/enroll`, "POST", {
      studentIds: [stu1Id, stu2Id]
    }, adminToken);
    assert(enrollRes.status === 200 && enrollRes.data.subject.students.length === 2, "Admin enrolls Student Alpha and Student Beta into subject");

    // 1.5 Unenroll and re-enroll student verification
    const unenrollRes = await makeRequest(`/api/subjects/${subject._id}/unenroll`, "POST", {
      studentId: stu2Id
    }, adminToken);
    assert(unenrollRes.status === 200 && unenrollRes.data.subject.students.length === 1, "Admin unenrolls a student from subject");

    // Re-enroll student 2 for attendance tests
    await makeRequest(`/api/subjects/${subject._id}/enroll`, "POST", {
      studentIds: [stu2Id]
    }, adminToken);

    // 1.6 Create temporary subject and test delete
    const tempSub = await makeRequest("/api/subjects", "POST", {
      name: "Temporary Subject",
      code: `TMP${timestamp.toString().slice(-3)}`,
      teacher: teacherId
    }, adminToken);
    const deleteRes = await makeRequest(`/api/subjects/${tempSub.data.subject._id}`, "DELETE", null, adminToken);
    assert(deleteRes.status === 200 && deleteRes.data.success, "Admin deletes subject cleanly");

    // ----------------------------------------------------
    // Section 2: Teacher Dashboard Features
    // ----------------------------------------------------
    console.log("\n--- Section 2: Teacher Dashboard Features ---");

    // 2.1 View Assigned Subjects
    const teacherSubs = await makeRequest("/api/subjects", "GET", null, teacherToken);
    assert(
      teacherSubs.status === 200 &&
      teacherSubs.data.subjects.some((s) => s._id === subject._id),
      "Teacher retrieves only their assigned subjects"
    );

    // 2.2 Check Session Roster for date & slot before marking
    const testDate = "2026-10-21";
    const initialSession = await makeRequest(
      `/api/attendance/subject/${subject._id}?date=${testDate}&slot=1`,
      "GET",
      null,
      teacherToken
    );
    assert(
      initialSession.status === 200 && initialSession.data.records.length === 0,
      "Session roster reports 0 recorded records before first marking"
    );

    // 2.3 Mark Attendance for Slot 1: Student 1 Present, Student 2 Absent
    const markSlot1 = await makeRequest("/api/attendance/mark", "POST", {
      subjectId: subject._id,
      date: testDate,
      slot: 1,
      records: [
        { studentId: stu1Id, status: "present" },
        { studentId: stu2Id, status: "absent" }
      ]
    }, teacherToken);
    assert(markSlot1.status === 200 && markSlot1.data.records.length === 2, "Teacher marks attendance for Slot 1 (Student 1: Present, Student 2: Absent)");

    // 2.4 In-place Edit Attendance without duplicates: Change Student 2 to Present
    const editSlot1 = await makeRequest("/api/attendance/mark", "POST", {
      subjectId: subject._id,
      date: testDate,
      slot: 1,
      records: [
        { studentId: stu1Id, status: "present" },
        { studentId: stu2Id, status: "present" }
      ]
    }, teacherToken);
    assert(editSlot1.status === 200 && editSlot1.data.records.length === 2, "Teacher edits existing attendance record in-place");

    // Verify session record count is still 2 (no duplicate rows created)
    const sessionCheck = await makeRequest(
      `/api/attendance/subject/${subject._id}?date=${testDate}&slot=1`,
      "GET",
      null,
      teacherToken
    );
    assert(sessionCheck.data.records.length === 2, "Duplicate prevention verified: record count remains 2 after edit");
    const stu2Rec = sessionCheck.data.records.find((r) => (r.student._id || r.student) === stu2Id);
    assert(stu2Rec && stu2Rec.status === "present", "Student 2 status correctly updated to 'present'");

    // 2.5 Multi-Slot Support: Mark Slot 2 on the same date (Student 1 Present, Student 2 Absent)
    const markSlot2 = await makeRequest("/api/attendance/mark", "POST", {
      subjectId: subject._id,
      date: testDate,
      slot: 2,
      records: [
        { studentId: stu1Id, status: "present" },
        { studentId: stu2Id, status: "absent" }
      ]
    }, teacherToken);
    assert(markSlot2.status === 200, "Teacher marks consecutive class Slot 2 on the same date");

    // Add 2 more sessions to create a realistic shortage (< 75%) for Student 2:
    // Session 3: date 2026-10-22, slot 1 -> Student 1 Present, Student 2 Absent
    await makeRequest("/api/attendance/mark", "POST", {
      subjectId: subject._id,
      date: "2026-10-22",
      slot: 1,
      records: [
        { studentId: stu1Id, status: "present" },
        { studentId: stu2Id, status: "absent" }
      ]
    }, teacherToken);

    // Session 4: date 2026-10-23, slot 1 -> Student 1 Present, Student 2 Absent
    await makeRequest("/api/attendance/mark", "POST", {
      subjectId: subject._id,
      date: "2026-10-23",
      slot: 1,
      records: [
        { studentId: stu1Id, status: "present" },
        { studentId: stu2Id, status: "absent" }
      ]
    }, teacherToken);

    // Totals so far:
    // Total classes held = 4
    // Student 1: 4 present, 0 absent = 100% attendance (No shortage)
    // Student 2: 1 present, 3 absent = 25% attendance (Shortage < 75%)
    // Consecutive classes needed for Student 2: max(0, 3*4 - 4*1) = max(0, 12 - 4) = 8 classes

    // 2.6 Subject Attendance Summary
    const summaryRes = await makeRequest(`/api/attendance/summary/subject/${subject._id}`, "GET", null, teacherToken);
    assert(summaryRes.status === 200 && summaryRes.data.success, "Teacher retrieves subject attendance summary");
    assert(summaryRes.data.totalSessions === 4, "Subject summary reflects 4 total classes held");

    const stu1Summary = summaryRes.data.summary.find((s) => (s.student.id || s.student._id) === stu1Id);
    const stu2Summary = summaryRes.data.summary.find((s) => (s.student.id || s.student._id) === stu2Id);

    assert(stu1Summary && stu1Summary.percentage === 100 && !stu1Summary.isShortage, "Student 1 summary: 100% and no shortage");
    assert(
      stu2Summary &&
      stu2Summary.percentage === 25 &&
      stu2Summary.isShortage === true &&
      stu2Summary.classesNeededTo75 === 8,
      "Student 2 summary: 25% attendance, isShortage=true, classesNeededTo75=8"
    );

    // 2.7 Shortage list API
    const shortageRes = await makeRequest(`/api/attendance/shortage/subject/${subject._id}`, "GET", null, teacherToken);
    assert(shortageRes.status === 200 && shortageRes.data.shortageStudents.length === 1, "Teacher shortage list filters to only students < 75%");
    assert((shortageRes.data.shortageStudents[0].student.id || shortageRes.data.shortageStudents[0].student._id) === stu2Id, "Shortage list correctly identifies Student 2");

    // ----------------------------------------------------
    // Section 3: Student Dashboard Features
    // ----------------------------------------------------
    console.log("\n--- Section 3: Student Dashboard Features ---");

    // 3.1 Student 1 Dashboard Check
    const stu1Dashboard = await makeRequest("/api/attendance/student/me", "GET", null, student1Token);
    assert(stu1Dashboard.status === 200 && stu1Dashboard.data.success, "Student 1 personal attendance dashboard loads");
    assert(stu1Dashboard.data.reports.length === 1, "Student 1 has 1 enrolled course report");
    const stu1Report = stu1Dashboard.data.reports[0];
    assert(
      stu1Report.totalClasses === 4 &&
      stu1Report.attendedClasses === 4 &&
      stu1Report.percentage === 100 &&
      stu1Report.isShortage === false &&
      stu1Report.classesNeededTo75 === 0,
      "Student 1 report shows 100% attendance with good standing"
    );
    assert(stu1Report.history.length === 4, "Student 1 has 4 date-wise session history entries");

    // 3.2 Student 2 Dashboard Check (Shortage Scenario)
    const stu2Dashboard = await makeRequest("/api/attendance/student/me", "GET", null, student2Token);
    assert(stu2Dashboard.status === 200 && stu2Dashboard.data.success, "Student 2 personal attendance dashboard loads");
    const stu2Report = stu2Dashboard.data.reports[0];
    assert(
      stu2Report.totalClasses === 4 &&
      stu2Report.attendedClasses === 1 &&
      stu2Report.percentage === 25 &&
      stu2Report.isShortage === true &&
      stu2Report.classesNeededTo75 === 8,
      "Student 2 report correctly highlights shortage and prompts 8 consecutive classes needed"
    );
    assert(stu2Report.history.length === 4, "Student 2 has date-wise session history with Slot numbers and status");

    // ----------------------------------------------------
    // Section 4: Role Restrictions & Security
    // ----------------------------------------------------
    console.log("\n--- Section 4: Role Restrictions & Security ---");

    // 4.1 Student cannot view Admin stats
    const studentStatsForbidden = await makeRequest("/api/auth/stats", "GET", null, student1Token);
    assert(studentStatsForbidden.status === 403, "Student is forbidden (403) from accessing admin stats");

    // 4.2 Teacher cannot create subject
    const teacherCreateForbidden = await makeRequest("/api/subjects", "POST", {
      name: "Hacked Subject",
      code: "HACK101",
      teacher: teacherId
    }, teacherToken);
    assert(teacherCreateForbidden.status === 403, "Teacher is forbidden (403) from creating subjects");

    // 4.3 Student cannot mark attendance
    const studentMarkForbidden = await makeRequest("/api/attendance/mark", "POST", {
      subjectId: subject._id,
      date: testDate,
      slot: 1,
      records: [{ studentId: stu1Id, status: "present" }]
    }, student1Token);
    assert(studentMarkForbidden.status === 403, "Student is forbidden (403) from marking attendance");

    console.log(`\n==================================================`);
    console.log(`  ALL ${passedCount}/${totalCount} TESTS PASSED SUCCESSFULLY!  `);
    console.log(`==================================================\n`);
    process.exit(0);
  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runStage5Tests();
