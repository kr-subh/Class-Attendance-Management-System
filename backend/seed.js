require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const connectDB = require("./config/db");
const User = require("./models/User");
const Subject = require("./models/Subject");
const Attendance = require("./models/Attendance");

async function seedData() {
  try {
    await connectDB();
    console.log("Seeding database...");

    // Clear existing sample collections (optional: only clear if testing)
    await User.deleteMany({ email: { $regex: /@demo\.attendance\.edu$/i } });
    await Subject.deleteMany({ code: "CS101-DEMO" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("Password123!", salt);

    // 1. Create Admin
    const admin = await User.create({
      name: "System Administrator",
      email: "admin@demo.attendance.edu",
      password: hashedPassword,
      role: "admin",
      department: "Administration"
    });
    console.log("✅ Admin seeded: admin@demo.attendance.edu / Password123!");

    // 2. Create Teacher
    const teacher = await User.create({
      name: "Prof. Alan Turing",
      email: "turing@demo.attendance.edu",
      password: hashedPassword,
      role: "teacher",
      department: "Computer Science"
    });
    console.log("✅ Teacher seeded: turing@demo.attendance.edu / Password123!");

    // 3. Create Students
    const student1 = await User.create({
      name: "Aman Gupta",
      email: "aman@demo.attendance.edu",
      password: hashedPassword,
      role: "student",
      rollNo: "CS-2026-001",
      department: "Computer Science"
    });

    const student2 = await User.create({
      name: "Sneha Sharma",
      email: "sneha@demo.attendance.edu",
      password: hashedPassword,
      role: "student",
      rollNo: "CS-2026-002",
      department: "Computer Science"
    });
    console.log("✅ Students seeded: aman@demo.attendance.edu, sneha@demo.attendance.edu / Password123!");

    // 4. Create Subject
    const subject = await Subject.create({
      name: "Data Structures & Algorithms",
      code: "CS101-DEMO",
      teacher: teacher._id,
      students: [student1._id, student2._id]
    });
    console.log("✅ Subject seeded: Data Structures & Algorithms (CS101-DEMO)");

    // 5. Seed sample attendance sessions
    await Attendance.deleteMany({ subject: subject._id });

    // Session 1: Slot 1 on 2026-10-20 (Both Present)
    await Attendance.create([
      { subject: subject._id, student: student1._id, date: "2026-10-20", slot: 1, status: "present", markedBy: teacher._id },
      { subject: subject._id, student: student2._id, date: "2026-10-20", slot: 1, status: "present", markedBy: teacher._id }
    ]);

    // Session 2: Slot 2 on 2026-10-20 (Student 1 Present, Student 2 Absent)
    await Attendance.create([
      { subject: subject._id, student: student1._id, date: "2026-10-20", slot: 2, status: "present", markedBy: teacher._id },
      { subject: subject._id, student: student2._id, date: "2026-10-20", slot: 2, status: "absent", markedBy: teacher._id }
    ]);

    console.log("✅ Sample attendance sessions seeded successfully!");
    console.log("\nDemo Credentials:");
    console.log("- Admin:   admin@demo.attendance.edu   / Password123!");
    console.log("- Teacher: turing@demo.attendance.edu  / Password123!");
    console.log("- Student: aman@demo.attendance.edu    / Password123!");
    console.log("- Student: sneha@demo.attendance.edu   / Password123!");

    process.exit(0);
  } catch (error) {
    console.error("Seeding Error:", error);
    process.exit(1);
  }
}

seedData();
