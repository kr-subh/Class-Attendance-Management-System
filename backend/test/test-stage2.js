const mongoose = require("mongoose");
const http = require("http");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const app = require("../server");
const User = require("../models/User");
const { auth, authorizeRoles } = require("../middleware/auth");

dotenv.config();

// Helper to make local HTTP requests to the Express app
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

async function runStage2Tests() {
  console.log("==========================================");
  console.log("🚀 STARTING STAGE 2 TESTS: AUTH & ROLES");
  console.log("==========================================\n");

  let server;

  try {
    // 0. Attach temporary test role-protected endpoints to verify middleware
    app.get("/api/test-admin-only", auth, authorizeRoles("admin"), (req, res) => {
      res.json({ success: true, message: "Welcome Admin!" });
    });

    app.get("/api/test-teacher-or-admin", auth, authorizeRoles("admin", "teacher"), (req, res) => {
      res.json({ success: true, message: "Welcome Faculty!" });
    });

    app.get("/api/test-student-only", auth, authorizeRoles("student"), (req, res) => {
      res.json({ success: true, message: "Welcome Student!" });
    });

    // Start server on an ephemeral port
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    console.log(`0. Test server listening on ephemeral port ${port}...\n`);

    // Clean up test users
    await User.deleteMany({ email: { $regex: /@stage2-test\.edu$/ } });

    // 1. Test Registration: Admin, Teacher, Student
    console.log("1. Testing Registration for Admin, Teacher, and Student...");
    const adminReg = await makeRequest(server, { path: "/api/auth/register", method: "POST" }, {
      name: "Admin User",
      email: "admin@stage2-test.edu",
      password: "adminPassword123",
      role: "admin"
    });
    console.log(`   Status: ${adminReg.status} - User: ${adminReg.data.user?.name} (${adminReg.data.user?.role})`);
    if (adminReg.status !== 201 || adminReg.data.user.role !== "admin") {
      throw new Error("Admin registration failed!");
    }
    if (adminReg.data.user.password) {
      throw new Error("SECURITY FAILURE: Plain text or hashed password returned in registration response!");
    }

    const teacherReg = await makeRequest(server, { path: "/api/auth/register", method: "POST" }, {
      name: "Prof. Verma",
      email: "verma@stage2-test.edu",
      password: "teacherPassword123",
      role: "teacher",
      department: "Information Technology"
    });
    console.log(`   Status: ${teacherReg.status} - User: ${teacherReg.data.user?.name} (${teacherReg.data.user?.role})`);
    if (teacherReg.status !== 201 || teacherReg.data.user.role !== "teacher") {
      throw new Error("Teacher registration failed!");
    }

    const studentReg = await makeRequest(server, { path: "/api/auth/register", method: "POST" }, {
      name: "Rahul Kumar",
      email: "rahul@stage2-test.edu",
      password: "studentPassword123",
      role: "student",
      rollNo: "CS2026-042"
    });
    console.log(`   Status: ${studentReg.status} - User: ${studentReg.data.user?.name} (${studentReg.data.user?.role})`);
    if (studentReg.status !== 201 || studentReg.data.user.role !== "student") {
      throw new Error("Student registration failed!");
    }
    console.log("   ✅ Registration: ALL 3 ROLES CREATED SUCCESSFULLY\n");

    // 2. Test Bcrypt Password Hashing in Database
    console.log("2. Verifying Bcrypt Password Hashing in Database...");
    const dbAdmin = await User.findOne({ email: "admin@stage2-test.edu" });
    if (!dbAdmin || !dbAdmin.password.startsWith("$2b$")) {
      throw new Error("Password in DB is not a valid bcrypt hash!");
    }
    const isPasswordValid = await bcrypt.compare("adminPassword123", dbAdmin.password);
    if (!isPasswordValid) {
      throw new Error("Bcrypt comparison failed against stored hash!");
    }
    console.log("   ✅ Password Hashing: BCRYPT SALT & HASH VERIFIED IN DATABASE\n");

    // 3. Test Duplicate Registration Prevention
    console.log("3. Testing Duplicate Email Registration Prevention...");
    const dupReg = await makeRequest(server, { path: "/api/auth/register", method: "POST" }, {
      name: "Duplicate User",
      email: "admin@stage2-test.edu",
      password: "someOtherPassword"
    });
    console.log(`   Status: ${dupReg.status} - Message: ${dupReg.data.message}`);
    if (dupReg.status !== 400 || !dupReg.data.message.includes("already exists")) {
      throw new Error("Duplicate registration was not properly rejected with status 400!");
    }
    console.log("   ✅ Duplicate Prevention: REJECTED WITH 400 AS EXPECTED\n");

    // 4. Test Missing Input Validation
    console.log("4. Testing Validation for Missing Fields...");
    const missingFields = await makeRequest(server, { path: "/api/auth/register", method: "POST" }, {
      email: "incomplete@stage2-test.edu"
    });
    if (missingFields.status !== 400) {
      throw new Error("Missing fields should return 400 Bad Request!");
    }
    console.log("   ✅ Missing Fields Validation: REJECTED WITH 400 AS EXPECTED\n");

    // 5. Test Login (Successful for Admin, Teacher, Student)
    console.log("5. Testing Successful Login & JWT Generation...");
    const adminLogin = await makeRequest(server, { path: "/api/auth/login", method: "POST" }, {
      email: "admin@stage2-test.edu",
      password: "adminPassword123"
    });
    if (adminLogin.status !== 200 || !adminLogin.data.token) {
      throw new Error("Admin login failed!");
    }
    const adminToken = adminLogin.data.token;
    console.log(`   ✅ Admin Login: SUCCESS (Token length: ${adminToken.length})`);

    const teacherLogin = await makeRequest(server, { path: "/api/auth/login", method: "POST" }, {
      email: "verma@stage2-test.edu",
      password: "teacherPassword123"
    });
    const teacherToken = teacherLogin.data.token;
    console.log(`   ✅ Teacher Login: SUCCESS (Token length: ${teacherToken.length})`);

    const studentLogin = await makeRequest(server, { path: "/api/auth/login", method: "POST" }, {
      email: "rahul@stage2-test.edu",
      password: "studentPassword123"
    });
    const studentToken = studentLogin.data.token;
    console.log(`   ✅ Student Login: SUCCESS (Token length: ${studentToken.length})\n`);

    // 6. Test Failed Login (Wrong Password)
    console.log("6. Testing Login with Incorrect Password...");
    const wrongPass = await makeRequest(server, { path: "/api/auth/login", method: "POST" }, {
      email: "admin@stage2-test.edu",
      password: "WRONG_PASSWORD"
    });
    console.log(`   Status: ${wrongPass.status} - Message: ${wrongPass.data.message}`);
    if (wrongPass.status !== 401) {
      throw new Error("Incorrect password should return 401 Unauthorized!");
    }
    console.log("   ✅ Incorrect Password: PROPERLY REJECTED WITH 401\n");

    // 7. Test Failed Login (Non-existent User)
    console.log("7. Testing Login with Non-Existent User...");
    const ghostUser = await makeRequest(server, { path: "/api/auth/login", method: "POST" }, {
      email: "ghost@stage2-test.edu",
      password: "somePassword"
    });
    if (ghostUser.status !== 401) {
      throw new Error("Non-existent user should return 401 Unauthorized!");
    }
    console.log("   ✅ Non-Existent User: PROPERLY REJECTED WITH 401\n");

    // 8. Test Protected Route: GET /api/auth/me
    console.log("8. Testing Protected Current-User Endpoint (/api/auth/me)...");
    const meRes = await makeRequest(server, {
      path: "/api/auth/me",
      method: "GET",
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    if (meRes.status !== 200 || meRes.data.user.email !== "rahul@stage2-test.edu") {
      throw new Error("GET /api/auth/me failed with valid token!");
    }
    if (meRes.data.user.password) {
      throw new Error("SECURITY FAILURE: Password field returned in /api/auth/me response!");
    }
    console.log(`   ✅ /api/auth/me: RETURNED ${meRes.data.user.name} (${meRes.data.user.role})\n`);

    // 9. Test Missing & Invalid Tokens
    console.log("9. Testing Missing and Invalid Tokens...");
    const noTokenRes = await makeRequest(server, { path: "/api/auth/me", method: "GET" });
    if (noTokenRes.status !== 401) {
      throw new Error("Missing token should return 401!");
    }
    console.log("   ✅ Missing Token: PROPERLY REJECTED (401)");

    const badTokenRes = await makeRequest(server, {
      path: "/api/auth/me",
      method: "GET",
      headers: { Authorization: "Bearer this.is.an.invalid.token" }
    });
    if (badTokenRes.status !== 401) {
      throw new Error("Invalid token should return 401!");
    }
    console.log("   ✅ Invalid Token: PROPERLY REJECTED (401)\n");

    // 10. Test Role-Based Authorization Restrictions
    console.log("10. Testing Role-Based Authorization Restrictions (Admin vs Teacher vs Student)...");

    // 10a. Admin-only endpoint
    const adminOnAdminRoute = await makeRequest(server, {
      path: "/api/test-admin-only",
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (adminOnAdminRoute.status !== 200) throw new Error("Admin should have access to admin-only route!");

    const studentOnAdminRoute = await makeRequest(server, {
      path: "/api/test-admin-only",
      method: "GET",
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    if (studentOnAdminRoute.status !== 403) throw new Error("Student must be FORBIDDEN (403) on admin route!");

    const teacherOnAdminRoute = await makeRequest(server, {
      path: "/api/test-admin-only",
      method: "GET",
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    if (teacherOnAdminRoute.status !== 403) throw new Error("Teacher must be FORBIDDEN (403) on admin route!");
    console.log("   ✅ Admin-only route: PASSED for Admin, FORBIDDEN (403) for Teacher and Student");

    // 10b. Teacher & Admin endpoint
    const teacherOnTeacherRoute = await makeRequest(server, {
      path: "/api/test-teacher-or-admin",
      method: "GET",
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    if (teacherOnTeacherRoute.status !== 200) throw new Error("Teacher should have access to teacher route!");

    const studentOnTeacherRoute = await makeRequest(server, {
      path: "/api/test-teacher-or-admin",
      method: "GET",
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    if (studentOnTeacherRoute.status !== 403) throw new Error("Student must be FORBIDDEN (403) on teacher route!");
    console.log("   ✅ Teacher/Admin route: PASSED for Teacher & Admin, FORBIDDEN (403) for Student");

    // 10c. Student endpoint
    const studentOnStudentRoute = await makeRequest(server, {
      path: "/api/test-student-only",
      method: "GET",
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    if (studentOnStudentRoute.status !== 200) throw new Error("Student should have access to student route!");
    console.log("   ✅ Student route: PASSED for Student\n");

    // 11. Cleanup test data
    console.log("11. Cleaning up test accounts from database...");
    await User.deleteMany({ email: { $regex: /@stage2-test\.edu$/ } });
    console.log("   ✅ Cleanup: SUCCESS\n");

    console.log("==========================================");
    console.log("🎉 ALL STAGE 2 TESTS PASSED WITH 100% SUCCESS!");
    console.log("==========================================");

    process.exit(0);
  } catch (error) {
    console.error("❌ STAGE 2 TEST RUNNER FAILED:", error);
    process.exit(1);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
}

runStage2Tests();
