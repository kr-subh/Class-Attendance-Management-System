const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["admin", "teacher", "student"],
      default: "student"
    },
    rollNo: {
      type: String,
      trim: true,
      default: ""
    },
    department: {
      type: String,
      trim: true,
      default: "Computer Science"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
