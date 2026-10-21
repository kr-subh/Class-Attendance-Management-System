import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function TeacherDashboard() {
  const { token, user } = useAuth();

  // Assigned subjects
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [loading, setLoading] = useState(true);

  // Active Tab: 'marker' | 'summary'
  const [activeTab, setActiveTab] = useState("marker");

  // Attendance Marking State
  const [attendanceDate, setAttendanceDate] = useState(() => {
    return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  });
  const [attendanceSlot, setAttendanceSlot] = useState(1);
  const [studentStatuses, setStudentStatuses] = useState({}); // { [studentId]: 'present' | 'absent' }
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Subject Summary State
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [filterShortageOnly, setFilterShortageOnly] = useState(false);

  // Alert State
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

  // Load teacher's assigned subjects
  const loadSubjects = async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/subjects");
      const data = await res.json();

      if (res.ok && data.success) {
        setSubjects(data.subjects);
        if (data.subjects.length > 0 && !selectedSubjectId) {
          setSelectedSubjectId(data.subjects[0]._id);
        }
      } else {
        setAlert({ type: "error", message: data.message || "Failed to load assigned subjects." });
      }
    } catch (err) {
      setAlert({ type: "error", message: "Network error loading subjects." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  // Current selected subject object
  const currentSubject = subjects.find((s) => s._id === selectedSubjectId);

  // Load or prefill attendance roster for the selected subject, date, and slot
  const loadRosterForSession = async () => {
    if (!selectedSubjectId || !attendanceDate) return;

    try {
      const res = await authFetch(
        `/api/attendance/subject/${selectedSubjectId}?date=${attendanceDate}&slot=${attendanceSlot}`
      );
      const data = await res.json();

      const existingRecordMap = {};
      if (res.ok && data.records && data.records.length > 0) {
        setIsEditingExisting(true);
        data.records.forEach((rec) => {
          const sId = rec.student?._id || rec.student;
          existingRecordMap[sId] = rec.status;
        });
      } else {
        setIsEditingExisting(false);
      }

      // Initialize status for every enrolled student
      if (currentSubject && currentSubject.students) {
        const initialMap = {};
        currentSubject.students.forEach((st) => {
          initialMap[st._id] = existingRecordMap[st._id] || "present"; // Default to present if new session
        });
        setStudentStatuses(initialMap);
      }
    } catch (err) {
      console.error("Failed to load session attendance records:", err);
    }
  };

  // Whenever subject, date, or slot changes, load the session roster
  useEffect(() => {
    if (activeTab === "marker") {
      loadRosterForSession();
    }
  }, [selectedSubjectId, attendanceDate, attendanceSlot, activeTab]);

  // Load Subject Summary
  const loadSubjectSummary = async () => {
    if (!selectedSubjectId) return;

    try {
      setSummaryLoading(true);
      const res = await authFetch(`/api/attendance/summary/subject/${selectedSubjectId}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setSummaryData(data);
      } else {
        setAlert({ type: "error", message: data.message || "Failed to load summary." });
      }
    } catch (err) {
      setAlert({ type: "error", message: "Error loading attendance summary." });
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "summary") {
      loadSubjectSummary();
    }
  }, [selectedSubjectId, activeTab]);

  // Toggle status for a student
  const handleToggleStatus = (studentId) => {
    setStudentStatuses((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === "present" ? "absent" : "present"
    }));
  };

  // Mark all present
  const handleMarkAll = (status) => {
    if (!currentSubject) return;
    const newMap = {};
    currentSubject.students.forEach((s) => {
      newMap[s._id] = status;
    });
    setStudentStatuses(newMap);
  };

  // Save Attendance to Backend
  const handleSaveAttendance = async () => {
    if (!currentSubject || !currentSubject.students || currentSubject.students.length === 0) {
      setAlert({ type: "error", message: "No enrolled students to mark attendance for." });
      return;
    }

    const records = currentSubject.students.map((s) => ({
      studentId: s._id,
      status: studentStatuses[s._id] || "absent"
    }));

    try {
      setSavingAttendance(true);
      setAlert({ type: "", message: "" });

      const res = await authFetch("/api/attendance/mark", {
        method: "POST",
        body: JSON.stringify({
          subjectId: selectedSubjectId,
          date: attendanceDate,
          slot: attendanceSlot,
          records
        })
      });

      const data = await res.json();

      if (res.ok) {
        setAlert({
          type: "success",
          message: `Attendance ${isEditingExisting ? "updated" : "saved"} successfully for ${data.count} student(s)!`
        });
        setIsEditingExisting(true);
      } else {
        setAlert({ type: "error", message: data.message || "Failed to save attendance." });
      }
    } catch (err) {
      setAlert({ type: "error", message: "Network error saving attendance." });
    } finally {
      setSavingAttendance(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading Faculty Portal...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Top Banner */}
      <div className="dashboard-header-card card">
        <div className="header-badge-row">
          <span className="role-badge role-teacher">Faculty Portal</span>
        </div>
        <h2>Attendance Management</h2>
        <p>Welcome, {user?.name}. Mark, edit, and monitor class attendance records.</p>
      </div>

      {alert.message && (
        <div className={`alert ${alert.type === "error" ? "alert-error" : "alert-success"}`}>
          {alert.message}
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="card text-center">
          <h3>No Assigned Subjects</h3>
          <p className="text-muted" style={{ marginTop: "8px" }}>
            You do not have any subjects assigned to you yet. Please contact an Administrator.
          </p>
        </div>
      ) : (
        <>
          {/* Controls Bar: Select Subject & Tabs */}
          <div className="card" style={{ marginBottom: "20px" }}>
            <div className="teacher-controls-bar">
              <div className="subject-selector-group">
                <label htmlFor="subjectSelect">Current Subject:</label>
                <select
                  id="subjectSelect"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="form-select"
                >
                  {subjects.map((sub) => (
                    <option key={sub._id} value={sub._id}>
                      {sub.name} ({sub.code}) - {sub.students?.length || 0} Students
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub-tabs */}
              <div className="tab-buttons">
                <button
                  type="button"
                  className={`tab-btn ${activeTab === "marker" ? "active" : ""}`}
                  onClick={() => setActiveTab("marker")}
                >
                  📝 Mark / Edit Attendance
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === "summary" ? "active" : ""}`}
                  onClick={() => setActiveTab("summary")}
                >
                  📊 Subject Summary & Shortage
                </button>
              </div>
            </div>
          </div>

          {/* TAB 1: MARK / EDIT ATTENDANCE */}
          {activeTab === "marker" && (
            <div className="card">
              <div className="session-config-bar">
                <div className="form-group">
                  <label htmlFor="sessionDate">Class Date</label>
                  <input
                    id="sessionDate"
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="form-select"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="sessionSlot">Class Slot (Consecutive Classes)</label>
                  <select
                    id="sessionSlot"
                    value={attendanceSlot}
                    onChange={(e) => setAttendanceSlot(Number(e.target.value))}
                    className="form-select"
                  >
                    <option value={1}>Slot 1 (Regular Lecture)</option>
                    <option value={2}>Slot 2 (Consecutive Lecture / Lab Block)</option>
                    <option value={3}>Slot 3 (Extra Class / Tutorial)</option>
                  </select>
                </div>

                <div className="status-notice-chip">
                  {isEditingExisting ? (
                    <span className="badge-editing">⚠️ Editing Existing Attendance</span>
                  ) : (
                    <span className="badge-new">✨ New Attendance Session</span>
                  )}
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="roster-action-bar">
                <div className="quick-buttons">
                  <button
                    type="button"
                    onClick={() => handleMarkAll("present")}
                    className="btn-quick btn-quick-present"
                  >
                    ✓ Mark All Present
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarkAll("absent")}
                    className="btn-quick btn-quick-absent"
                  >
                    ✕ Mark All Absent
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  className="btn-primary"
                  style={{ width: "auto", padding: "8px 24px" }}
                  disabled={savingAttendance || !currentSubject?.students?.length}
                >
                  {savingAttendance ? "Saving..." : isEditingExisting ? "Update Attendance" : "Save Attendance"}
                </button>
              </div>

              {/* Enrolled Students Roster */}
              {!currentSubject?.students || currentSubject.students.length === 0 ? (
                <div className="empty-state">
                  No students are enrolled in this subject yet. An Administrator must enroll students first.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="custom-table roster-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Roll No</th>
                        <th>Student Name</th>
                        <th>Email</th>
                        <th style={{ textAlign: "center" }}>Attendance Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSubject.students.map((st, idx) => {
                        const status = studentStatuses[st._id] || "present";
                        return (
                          <tr key={st._id}>
                            <td>{idx + 1}</td>
                            <td><strong>{st.rollNo || "N/A"}</strong></td>
                            <td>{st.name}</td>
                            <td>{st.email}</td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(st._id)}
                                className={`attendance-toggle-btn ${status === "present" ? "is-present" : "is-absent"}`}
                              >
                                {status === "present" ? "🟢 Present" : "🔴 Absent"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SUBJECT SUMMARY & SHORTAGE REPORT */}
          {activeTab === "summary" && (
            <div className="card">
              {summaryLoading || !summaryData ? (
                <div className="loading-screen" style={{ height: "30vh" }}>
                  <div className="spinner"></div>
                  <p>Calculating attendance percentages & shortage statistics...</p>
                </div>
              ) : (
                <div>
                  <div className="summary-metrics-row">
                    <div className="metric-box">
                      <h4>Total Sessions Held</h4>
                      <p className="metric-val">{summaryData.totalSessions}</p>
                    </div>
                    <div className="metric-box">
                      <h4>Enrolled Students</h4>
                      <p className="metric-val">{summaryData.subject.enrolledCount}</p>
                    </div>
                    <div className={`metric-box ${summaryData.shortageCount > 0 ? "metric-alert" : ""}`}>
                      <h4>Students Below 75%</h4>
                      <p className="metric-val">{summaryData.shortageCount}</p>
                    </div>
                  </div>

                  <div className="summary-filter-row">
                    <h3>Student Attendance Summary</h3>
                    <label className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={filterShortageOnly}
                        onChange={(e) => setFilterShortageOnly(e.target.checked)}
                      />
                      <span>Show only students below 75% shortage</span>
                    </label>
                  </div>

                  {summaryData.summary.length === 0 ? (
                    <div className="empty-state">No students enrolled to summarize.</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Roll No</th>
                            <th>Student</th>
                            <th>Attended / Total</th>
                            <th>Percentage</th>
                            <th>Status & Actions Needed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryData.summary
                            .filter((s) => !filterShortageOnly || s.isShortage)
                            .map((s) => (
                              <tr key={s.student.id} className={s.isShortage ? "row-shortage" : ""}>
                                <td><strong>{s.student.rollNo || "-"}</strong></td>
                                <td>
                                  <div>{s.student.name}</div>
                                  <small className="text-muted">{s.student.email}</small>
                                </td>
                                <td>
                                  <strong>{s.attendedClasses}</strong> / {s.totalClasses}
                                </td>
                                <td>
                                  <div className="percentage-cell">
                                    <span
                                      className={`pct-badge ${s.isShortage ? "pct-bad" : "pct-good"}`}
                                    >
                                      {s.percentage}%
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  {s.isShortage ? (
                                    <div className="shortage-info-badge">
                                      ⚠️ Shortage: Must attend <strong>{s.classesNeededTo75}</strong> consecutive classes to reach 75%
                                    </div>
                                  ) : (
                                    <span className="good-standing-badge">
                                      ✅ In Good Standing
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
