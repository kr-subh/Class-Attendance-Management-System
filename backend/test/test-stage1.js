const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/User");
const Subject = require("../models/Subject");
const Attendance = require("../models/Attendance");

dotenv.config();

async function runStage1Tests() {
  console.log("==========================================");
  console.log("🚀 STARTING STAGE 1 TESTS: BACKEND & DATABASE");
  console.log("==========================================\n");

  const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/attendance_db";

  try {
    // 1. Test Database Connection
    console.log("1. Connecting to MongoDB...");
    await mongoose.connect(mongoURI);
    console.log("   ✅ MongoDB Connection: SUCCESS\n");

    // Clean up any old test records first
    await User.deleteMany({ email: { $regex: /@test-stage1\.edu$/ } });
    await Subject.deleteMany({ code: "CS101-TEST" });

    // 2. Test User Model Creation (Admin, Teacher, Student)
    console.log("2. Testing User Model Creation...");
    const teacher = await User.create({
      name: "Dr. Sharma",
      email: "sharma@test-stage1.edu",
      password: "hashedpassword123",
      role: "teacher",
      department: "Computer Science"
    });

    const student = await User.create({
      name: "Aman Gupta",
      email: "aman@test-stage1.edu",
      password: "hashedpassword123",
      role: "student",
      rollNo: "CS-2026-001",
      department: "Computer Science"
    });

    console.log(`   ✅ Teacher created: ${teacher.name} (${teacher.role})`);
    console.log(`   ✅ Student created: ${student.name} (${student.rollNo})\n`);

    // 3. Test Subject Model Creation with Relations
    console.log("3. Testing Subject Model Creation...");
    const subject = await Subject.create({
      name: "Data Structures & Algorithms",
      code: "CS101-TEST",
      teacher: teacher._id,
      students: [student._id]
    });
    console.log(`   ✅ Subject created: ${subject.name} [${subject.code}]`);
    console.log(`   ✅ Subject teacher linked: ${subject.teacher}`);
    console.log(`   ✅ Subject enrolled students: ${subject.students.length}\n`);

    // 4. Test Attendance Marking (Slot 1)
    console.log("4. Testing Attendance Record Creation (Slot 1)...");
    const testDate = "2026-10-21";
    const record1 = await Attendance.create({
      subject: subject._id,
      student: student._id,
      date: testDate,
      slot: 1,
      status: "present",
      markedBy: teacher._id
    });
    console.log(`   ✅ Attendance marked: Student ${student.name} -> ${record1.status} (Slot 1)\n`);

    // 5. Test Duplicate Prevention (Should Throw Mongo Duplicate Error E11000)
    console.log("5. Testing Duplicate Prevention for Slot 1...");
    let duplicateCaught = false;
    try {
      await Attendance.create({
        subject: subject._id,
        student: student._id,
        date: testDate,
        slot: 1,
        status: "absent", // Attempt duplicate marking on same slot
        markedBy: teacher._id
      });
    } catch (err) {
      if (err.code === 11000) {
        duplicateCaught = true;
        console.log("   ✅ Duplicate prevented successfully: Caught MongoDB E11000 duplicate key error!\n");
      } else {
        throw err;
      }
    }

    if (!duplicateCaught) {
      throw new Error("FAILED: Duplicate record was inserted but should have been rejected!");
    }

    // 6. Test Consecutive Classes Stretch Goal (Slot 2 on same date should SUCCEED)
    console.log("6. Testing Consecutive Class (Slot 2) on Same Date...");
    const record2 = await Attendance.create({
      subject: subject._id,
      student: student._id,
      date: testDate,
      slot: 2,
      status: "present",
      markedBy: teacher._id
    });
    console.log(`   ✅ Consecutive Class (Slot 2) marked successfully without conflict: ID ${record2._id}\n`);

    // 7. Cleanup Test Data
    console.log("7. Cleaning up test documents...");
    await Attendance.deleteMany({ subject: subject._id });
    await Subject.deleteOne({ _id: subject._id });
    await User.deleteMany({ _id: { $in: [teacher._id, student._id] } });
    console.log("   ✅ Cleanup: SUCCESS\n");

    console.log("==========================================");
    console.log("🎉 ALL STAGE 1 TESTS PASSED SUCCESSFULLY!");
    console.log("==========================================");

    process.exit(0);
  } catch (error) {
    console.error("❌ TEST RUNNER FAILED:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runStage1Tests();
