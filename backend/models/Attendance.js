const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    date: {
      type: String, // YYYY-MM-DD format ensures clean day-level matching
      required: true
    },
    slot: {
      type: Number, // 1 for regular lecture, 2 for consecutive/second slot
      default: 1
    },
    status: {
      type: String,
      enum: ["present", "absent"],
      required: true
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Compound Unique Index to prevent duplicate attendance records for the same student, subject, date, and slot
attendanceSchema.index(
  { student: 1, subject: 1, date: 1, slot: 1 },
  { unique: true }
);

module.exports = mongoose.model("Attendance", attendanceSchema);
