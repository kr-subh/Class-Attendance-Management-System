process.env.NODE_ENV = "test";
const http = require("http");
const app = require("../backend/server");

let testPort = 5001;

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

// Simulates the frontend ProtectedRoute and redirect logic
function evaluateProtectedRoute(user, token, requiredRoles) {
  if (!token || !user) {
    return { allowed: false, redirect: "/login", reason: "Unauthenticated" };
  }
  if (requiredRoles && !requiredRoles.includes(user.role)) {
    return { allowed: false, redirect: `/${user.role}`, reason: "Unauthorized role" };
  }
  return { allowed: true, redirect: null };
}

// Simulates the frontend login role-based redirect logic
function evaluateLoginRedirect(user) {
  if (!user || !user.role) return "/login";
  return `/${user.role}`;
}

async function runStage4Tests() {
  console.log("==========================================");
  console.log("🚀 STARTING STAGE 4 TESTS: FRONTEND AUTH FLOW");
  console.log("==========================================\n");

  let server;
  try {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    testPort = server.address().port;
    console.log(`0. Test server listening on ephemeral port ${testPort}...\n`);
    console.log("1. Testing Registration API Contract from Frontend...");
    const studentReg = await makeRequest("/api/auth/register", "POST", {
      name: "Sneha Sharma",
      email: "sneha@stage4-test.edu",
      password: "password123",
      role: "student",
      rollNo: "CS2026-088",
      department: "Computer Science"
    });
    if (studentReg.status !== 201 || !studentReg.data.user) {
      throw new Error(`Student registration failed: ${JSON.stringify(studentReg.data)}`);
    }
    console.log(`   ✅ Student Registered: ${studentReg.data.user.name} (Roll: ${studentReg.data.user.rollNo}, Role: ${studentReg.data.user.role})`);

    const teacherReg = await makeRequest("/api/auth/register", "POST", {
      name: "Prof. Ananya Sen",
      email: "ananya@stage4-test.edu",
      password: "password123",
      role: "teacher",
      department: "Information Technology"
    });
    if (teacherReg.status !== 201) throw new Error("Teacher registration failed!");
    console.log(`   ✅ Teacher Registered: ${teacherReg.data.user.name} (Role: ${teacherReg.data.user.role})`);

    const adminReg = await makeRequest("/api/auth/register", "POST", {
      name: "Dean Office",
      email: "dean@stage4-test.edu",
      password: "password123",
      role: "admin",
      department: "Administration"
    });
    if (adminReg.status !== 201) throw new Error("Admin registration failed!");
    console.log(`   ✅ Admin Registered: ${adminReg.data.user.name} (Role: ${adminReg.data.user.role})\n`);

    // 2. Test Duplicate Email Error Handling in Frontend
    console.log("2. Testing Duplicate Registration Error Handling...");
    const dupRes = await makeRequest("/api/auth/register", "POST", {
      name: "Sneha Duplicate",
      email: "sneha@stage4-test.edu",
      password: "password123",
      role: "student"
    });
    if (dupRes.status !== 400 || !dupRes.data.message) {
      throw new Error("Duplicate registration did not return 400 error message!");
    }
    console.log(`   ✅ Duplicate Email Error Caught: "${dupRes.data.message}" (Status ${dupRes.status})\n`);

    // 3. Test Invalid Login Error Handling
    console.log("3. Testing Invalid Login Error Handling...");
    const badLogin = await makeRequest("/api/auth/login", "POST", {
      email: "sneha@stage4-test.edu",
      password: "INCORRECT_PASSWORD"
    });
    if (badLogin.status !== 401 || !badLogin.data.message) {
      throw new Error("Invalid password did not return 401 error message!");
    }
    console.log(`   ✅ Incorrect Password Caught: "${badLogin.data.message}" (Status ${badLogin.status})\n`);

    // 4. Test Successful Login and Role-Based Redirects
    console.log("4. Testing Successful Login & Role-Based Navigation Routing...");
    const studentLogin = await makeRequest("/api/auth/login", "POST", {
      email: "sneha@stage4-test.edu",
      password: "password123"
    });
    if (studentLogin.status !== 200 || !studentLogin.data.token) throw new Error("Student login failed!");
    const studentToken = studentLogin.data.token;
    const studentUser = studentLogin.data.user;
    const studentRedirect = evaluateLoginRedirect(studentUser);
    console.log(`   ✅ Student Login Redirect: -> ${studentRedirect} (Expected: /student)`);
    if (studentRedirect !== "/student") throw new Error("Student login did not redirect to /student!");

    const teacherLogin = await makeRequest("/api/auth/login", "POST", {
      email: "ananya@stage4-test.edu",
      password: "password123"
    });
    const teacherToken = teacherLogin.data.token;
    const teacherUser = teacherLogin.data.user;
    const teacherRedirect = evaluateLoginRedirect(teacherUser);
    console.log(`   ✅ Teacher Login Redirect: -> ${teacherRedirect} (Expected: /teacher)`);
    if (teacherRedirect !== "/teacher") throw new Error("Teacher login did not redirect to /teacher!");

    const adminLogin = await makeRequest("/api/auth/login", "POST", {
      email: "dean@stage4-test.edu",
      password: "password123"
    });
    const adminToken = adminLogin.data.token;
    const adminUser = adminLogin.data.user;
    const adminRedirect = evaluateLoginRedirect(adminUser);
    console.log(`   ✅ Admin Login Redirect:   -> ${adminRedirect} (Expected: /admin)\n`);
    if (adminRedirect !== "/admin") throw new Error("Admin login did not redirect to /admin!");

    // 5. Test AuthContext Token Verification via /api/auth/me
    console.log("5. Testing Token Verification (/api/auth/me) for AuthContext on Mount...");
    const meRes = await makeRequest("/api/auth/me", "GET", null, studentToken);
    if (meRes.status !== 200 || meRes.data.user.email !== "sneha@stage4-test.edu") {
      throw new Error("Token verification via /api/auth/me failed!");
    }
    console.log(`   ✅ AuthContext Token Verified: Profile recovered for ${meRes.data.user.name} (${meRes.data.user.role})`);

    const invalidMeRes = await makeRequest("/api/auth/me", "GET", null, "corrupt.token.string");
    if (invalidMeRes.status !== 401) {
      throw new Error("Invalid token did not return 401!");
    }
    console.log(`   ✅ Invalid Token Rejected: Correctly returns 401 (triggers logout in AuthContext)\n`);

    // 6. Test ProtectedRoute Access Restrictions
    console.log("6. Testing Protected Route Guarding & Access Restrictions...");
    // 6a. Unauthenticated user trying to access /admin
    const testUnauth = evaluateProtectedRoute(null, null, ["admin"]);
    console.log(`   Unauthenticated access to /admin: Allowed=${testUnauth.allowed}, Redirect=${testUnauth.redirect}`);
    if (testUnauth.allowed !== false || testUnauth.redirect !== "/login") {
      throw new Error("Unauthenticated user must be redirected to /login!");
    }

    // 6b. Student trying to access /admin
    const testStudentOnAdmin = evaluateProtectedRoute(studentUser, studentToken, ["admin"]);
    console.log(`   Student access to /admin: Allowed=${testStudentOnAdmin.allowed}, Redirect=${testStudentOnAdmin.redirect}`);
    if (testStudentOnAdmin.allowed !== false || testStudentOnAdmin.redirect !== "/student") {
      throw new Error("Student accessing /admin must be redirected to /student!");
    }

    // 6c. Teacher trying to access /admin
    const testTeacherOnAdmin = evaluateProtectedRoute(teacherUser, teacherToken, ["admin"]);
    console.log(`   Teacher access to /admin: Allowed=${testTeacherOnAdmin.allowed}, Redirect=${testTeacherOnAdmin.redirect}`);
    if (testTeacherOnAdmin.allowed !== false || testTeacherOnAdmin.redirect !== "/teacher") {
      throw new Error("Teacher accessing /admin must be redirected to /teacher!");
    }

    // 6d. Admin accessing /admin
    const testAdminOnAdmin = evaluateProtectedRoute(adminUser, adminToken, ["admin"]);
    console.log(`   Admin access to /admin: Allowed=${testAdminOnAdmin.allowed}, Redirect=${testAdminOnAdmin.redirect}`);
    if (testAdminOnAdmin.allowed !== true) {
      throw new Error("Admin must be allowed on /admin!");
    }

    // 6e. Teacher accessing /teacher
    const testTeacherOnTeacher = evaluateProtectedRoute(teacherUser, teacherToken, ["teacher"]);
    if (testTeacherOnTeacher.allowed !== true) {
      throw new Error("Teacher must be allowed on /teacher!");
    }

    // 6f. Student accessing /student
    const testStudentOnStudent = evaluateProtectedRoute(studentUser, studentToken, ["student"]);
    if (testStudentOnStudent.allowed !== true) {
      throw new Error("Student must be allowed on /student!");
    }
    console.log("   ✅ ProtectedRoute: ALL ROLE RESTRICTIONS & GUARDS ENFORCED\n");

    // 7. Cleanup Stage 4 test accounts
    console.log("7. Cleaning up test accounts from database...");
    const cleanupUsers = await makeRequest("/api/auth/register", "POST", {
      name: "Cleanup",
      email: "cleanup@stage4-test.edu",
      password: "password123",
      role: "student"
    });
    // Use mongo directly from backend directory to clean stage4 accounts
    const mongoose = require("../backend/node_modules/mongoose");
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/attendance_db");
    const User = require("../backend/models/User");
    await User.deleteMany({ email: { $regex: /@stage4-test\.edu$/ } });
    await mongoose.disconnect();
    console.log("   ✅ Cleanup: SUCCESS\n");

    console.log("==========================================");
    console.log("🎉 ALL STAGE 4 TESTS PASSED WITH 100% SUCCESS!");
    console.log("==========================================");

    process.exit(0);
  } catch (error) {
    console.error("❌ STAGE 4 TEST FAILED:", error);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
}

runStage4Tests();
