import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function StudentDashboard() {
  const { token, user } = useAuth();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSubject, setExpandedSubject] = useState(null);
  const [alert, setAlert] = useState({ type: "", message: "" });

  const authFetch = (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
  };

  const loadStudentAttendance = async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/attendance/student/me");
      const data = await res.json();

      if (res.ok && data.success) {
        setReports(data.reports);
      } else {
        setAlert({ type: "error", message: data.message || "Failed to load attendance report." });
      }
    } catch (err) {
      setAlert({ type: "error", message: "Network error loading attendance history." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentAttendance();
  }, []);

  // Compute overall aggregate across all subjects
  const overallTotal = reports.reduce((acc, r) => acc + r.totalClasses, 0);
  const overallAttended = reports.reduce((acc, r) => acc + r.attendedClasses, 0);
  const overallPercentage =
    overallTotal === 0 ? 0 : Math.round((overallAttended / overallTotal) * 100);
  const totalShortages = reports.filter((r) => r.isShortage).length;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading your personal attendance record...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Top Banner */}
      <div className="dashboard-header-card card">
        <div className="header-badge-row">
          <span className="role-badge role-student">Student Portal</span>
        </div>
        <h2>Attendance Overview</h2>
        <p>
          Welcome, <strong>{user?.name}</strong> | Roll No: <strong>{user?.rollNo || "N/A"}</strong> | Department: {user?.department || "General"}
        </p>
      </div>

      {alert.message && (
        <div className={`alert ${alert.type === "error" ? "alert-error" : "alert-success"}`}>
          {alert.message}
        </div>
      )}

      {/* Aggregate Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">📊</span>
          <div className="stat-details">
            <h3>{overallPercentage}%</h3>
            <p>Overall Aggregate</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📚</span>
          <div className="stat-details">
            <h3>{reports.length}</h3>
            <p>Enrolled Subjects</p>
          </div>
        </div>
        <div className={`stat-card ${totalShortages > 0 ? "stat-alert" : ""}`}>
          <span className="stat-icon">{totalShortages > 0 ? "⚠️" : "✅"}</span>
          <div className="stat-details">
            <h3>{totalShortages}</h3>
            <p>{totalShortages === 1 ? "Subject Below 75%" : "Subjects Below 75%"}</p>
          </div>
        </div>
      </div>

      {/* Enrolled Subjects List */}
      <div className="student-subjects-section">
        <h3 style={{ marginBottom: "16px" }}>Enrolled Course Attendance</h3>

        {reports.length === 0 ? (
          <div className="card text-center">
            <h3>No Enrolled Subjects</h3>
            <p className="text-muted" style={{ marginTop: "8px" }}>
              You are not enrolled in any subjects yet. Please ask an Administrator to enroll your roll number.
            </p>
          </div>
        ) : (
          <div className="subject-cards-list">
            {reports.map((report) => (
              <div
                key={report.subjectId}
                className={`card student-subject-card ${report.isShortage ? "subject-card-shortage" : ""}`}
              >
                <div className="subject-card-header">
                  <div>
                    <span className="subject-code-badge">{report.code}</span>
                    <h3 className="subject-title">{report.name}</h3>
                    <p className="subject-teacher">
                      Faculty: {report.teacher?.name || "Assigned Faculty"} ({report.teacher?.department || "Dept"})
                    </p>
                  </div>

                  <div className="subject-pct-box">
                    <span
                      className={`pct-badge-large ${report.isShortage ? "pct-bad" : "pct-good"}`}
                    >
                      {report.percentage}%
                    </span>
                    <span className="classes-ratio">
                      {report.attendedClasses} / {report.totalClasses} Classes
                    </span>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="progress-bar-container">
                  <div
                    className={`progress-bar-fill ${report.isShortage ? "fill-bad" : "fill-good"}`}
                    style={{ width: `${Math.min(report.percentage, 100)}%` }}
                  ></div>
                </div>

                {/* 75% Requirement Alert or Good Standing Badge */}
                {report.isShortage ? (
                  <div className="shortage-warning-banner">
                    <div className="warning-title">⚠️ ATTENDANCE SHORTAGE DETECTED</div>
                    <p>
                      Your attendance is currently <strong>{report.percentage}%</strong>, which is below the required 75% minimum.
                    </p>
                    <p className="needed-notice">
                      👉 You must attend the next <strong>{report.classesNeededTo75}</strong> consecutive class(es) to reach 75%.
                    </p>
                  </div>
                ) : (
                  <div className="good-standing-banner">
                    ✅ Good Standing: Your attendance satisfies the 75% minimum requirement.
                  </div>
                )}

                {/* Date-wise Attendance Accordion Toggle */}
                <div className="history-toggle-row">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSubject(
                        expandedSubject === report.subjectId ? null : report.subjectId
                      )
                    }
                    className="btn-history-toggle"
                  >
                    {expandedSubject === report.subjectId
                      ? "Hide Date-wise Attendance ▲"
                      : `View Date-wise Attendance (${report.history?.length || 0} Sessions) ▼`}
                  </button>
                </div>

                {/* Date-wise History Table */}
                {expandedSubject === report.subjectId && (
                  <div className="history-table-wrapper">
                    {report.history.length === 0 ? (
                      <p className="text-muted text-center" style={{ padding: "12px" }}>
                        No attendance sessions recorded yet for this course.
                      </p>
                    ) : (
                      <table className="custom-table history-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Class Slot</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.history.map((h, i) => (
                            <tr key={`${h.date}-${h.slot}-${i}`}>
                              <td><strong>{h.date}</strong></td>
                              <td>Slot {h.slot}</td>
                              <td>
                                <span
                                  className={`status-pill ${h.status === "present" ? "pill-present" : "pill-absent"}`}
                                >
                                  {h.status === "present" ? "🟢 Present" : "🔴 Absent"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
