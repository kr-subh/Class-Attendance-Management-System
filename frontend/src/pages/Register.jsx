import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [rollNo, setRollNo] = useState("");
  const [department, setDepartment] = useState("Computer Science");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);
    const result = await register({
      name,
      email,
      password,
      role,
      rollNo: role === "student" ? rollNo : "",
      department
    });
    setSubmitting(false);

    if (result.success) {
      navigate("/login", {
        state: { message: "Account created successfully! Please sign in." }
      });
    } else {
      setError(result.message || "Registration failed. Please try again.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-icon">📝</span>
          <h2>Create Account</h2>
          <p>Register as Student, Teacher, or Admin</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full Name *</label>
            <input
              id="name"
              type="text"
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              id="email"
              type="email"
              placeholder="e.g. john@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password (min 6 chars) *</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Account Role *</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="form-select"
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher (Faculty)</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          {role === "student" && (
            <div className="form-group">
              <label htmlFor="rollNo">Roll Number *</label>
              <input
                id="rollNo"
                type="text"
                placeholder="e.g. CS-2026-042"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                required={role === "student"}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="department">Department</label>
            <input
              id="department"
              type="text"
              placeholder="e.g. Computer Science"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Creating account..." : "Register"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{" "}
            <Link to="/login" className="auth-link">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
