import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function TeacherDashboard() {
  const { token } = useAuth();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [loading, setLoading] = useState(true);

  // Active Tab: 'marker' | 'summary'
  const [activeTab, setActiveTab] = useState("marker");

  // Attendance Marking State
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [attendanceSlot, setAttendanceSlot] = useState(1);
  const [studentStatuses, setStudentStatuses] = useState({});
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Subject Summary State
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [filterShortageOnly, setFilterShortageOnly] = useState(false);

  // Alerts
  const [alert, setAlert] = useState({ type: "", message: "" });

  const authFetch = (url, options = {}) =>
    fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });

  // Load teacher's assigned subjects on mount
  useEffect(() => {
    async function loadSubjects() {
      try {
        setLoading(true);
        const res = await authFetch("/api/subjects");
        const data = await res.json();

        if (res.ok && data.success) {
          setSubjects(data.subjects);
          if (data.subjects.length > 0) {
            setSelectedSubjectId(data.subjects[0]._id);
          }
        } else {
          setAlert({ type: "error", message: data.message || "Failed to load assigned subjects." });
        }
      } catch {
        setAlert({ type: "error", message: "Network error loading subjects." });
      } finally {
        setLoading(false);
      }
    }
    loadSubjects();
  }, []);

  const currentSubject = subjects.find((s) => s._id === selectedSubjectId);

  // Load session attendance roster
  useEffect(() => {
    if (!selectedSubjectId || !attendanceDate || activeTab !== "marker") return;

    async function loadRoster() {
      try {
        const res = await authFetch(
          `/api/attendance/subject/${selectedSubjectId}?date=${attendanceDate}&slot=${attendanceSlot}`
        );
        const data = await res.json();

        const existingMap = {};
        if (res.ok && data.records && data.records.length > 0) {
          setIsEditingExisting(true);
          data.records.forEach((rec) => {
            const sId = rec.student?._id || rec.student;
            existingMap[sId] = rec.status;
          });
        } else {
          setIsEditingExisting(false);
        }

        if (currentSubject && currentSubject.students) {
          const initialMap = {};
          currentSubject.students.forEach((st) => {
            initialMap[st._id] = existingMap[st._id] || "present";
          });
          setStudentStatuses(initialMap);
        }
      } catch (err) {
        console.error("Failed to load session roster:", err);
      }
    }
    loadRoster();
  }, [selectedSubjectId, attendanceDate, attendanceSlot, activeTab, currentSubject]);

  // Load subject summary
  useEffect(() => {
    if (!selectedSubjectId || activeTab !== "summary") return;

    async function loadSummary() {
      try {
        setSummaryLoading(true);
        const res = await authFetch(`/api/attendance/summary/subject/${selectedSubjectId}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setSummaryData(data);
        } else {
          setAlert({ type: "error", message: data.message || "Failed to load summary." });
        }
      } catch {
        setAlert({ type: "error", message: "Error loading attendance summary." });
      } finally {
        setSummaryLoading(false);
      }
    }
    loadSummary();
  }, [selectedSubjectId, activeTab]);

  // Toggle present/absent for a student
  const handleToggleStatus = (studentId) => {
    setStudentStatuses((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === "present" ? "absent" : "present"
    }));
  };

  // Mark all students present or absent
  const handleMarkAll = (status) => {
    if (!currentSubject) return;
    const updated = {};
    currentSubject.students.forEach((st) => {
      updated[st._id] = status;
    });
    setStudentStatuses(updated);
  };

  // Save or edit attendance
  const handleSaveAttendance = async () => {
    if (!currentSubject || !currentSubject.students || currentSubject.students.length === 0) {
      setAlert({ type: "error", message: "No students enrolled in this course to mark attendance." });
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
    } catch {
      setAlert({ type: "error", message: "Network error saving attendance." });
    } finally {
      setSavingAttendance(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading Teacher Portal...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Top Banner */}
      <div className="dashboard-header-card card">
        <div className="header-badge-row">
          <span className="role-badge role-teacher">Faculty Dashboard</span>
        </div>
        <h2>Attendance Management</h2>
        <p>Record daily class attendance, edit existing records, and monitor students below 75%.</p>
      </div>

      {alert.message && (
        <div className={`alert ${alert.type === "error" ? "alert-error" : "alert-success"}`}>
          {alert.message}
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="card text-center">
          <h3>No Subjects Assigned</h3>
          <p className="text-muted" style={{ marginTop: "8px" }}>
            You do not currently have any assigned subjects. Please contact the Administrator.
          </p>
        </div>
      ) : (
        <div>
          {/* Controls Bar: Subject, Date, Slot & Tabs */}
          <div className="teacher-controls-card card">
            <div className="controls-grid">
              <div className="form-group">
                <label htmlFor="teacherSubject">Select Subject</label>
                <select
                  id="teacherSubject"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="form-select"
                >
                  {subjects.map((sub) => (
                    <option key={sub._id} value={sub._id}>
                      {sub.code} - {sub.name} ({sub.students?.length || 0} students)
                    </option>
                  ))}
                </select>
              </div>

              {activeTab === "marker" && (
                <>
                  <div className="form-group">
                    <label htmlFor="attendanceDate">Attendance Date</label>
                    <input
                      id="attendanceDate"
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="attendanceSlot">Class Slot</label>
                    <select
                      id="attendanceSlot"
                      value={attendanceSlot}
                      onChange={(e) => setAttendanceSlot(Number(e.target.value))}
                      className="form-select"
                    >
                      <option value={1}>Slot 1 (Regular Lecture)</option>
                      <option value={2}>Slot 2 (Consecutive Lecture)</option>
                      <option value={3}>Slot 3 (Extra Class)</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="tab-buttons-row">
              <button
                type="button"
                onClick={() => setActiveTab("marker")}
                className={`tab-btn ${activeTab === "marker" ? "tab-active" : ""}`}
              >
                📋 Mark Attendance {isEditingExisting && <span className="chip-edit">Editing Existing</span>}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("summary")}
                className={`tab-btn ${activeTab === "summary" ? "tab-active" : ""}`}
              >
                📊 Subject Summary & Shortage Alert
              </button>
            </div>
          </div>

          {/* TAB 1: ATTENDANCE MARKER */}
          {activeTab === "marker" && (
            <div className="card">
              <div className="roster-header-bar">
                <div>
                  <h3>Class Roster ({currentSubject?.students?.length || 0} Students)</h3>
                  <p className="card-subtitle">
                    Session: <strong>{attendanceDate}</strong> | <strong>Slot {attendanceSlot}</strong>
                    {isEditingExisting && (
                      <span className="notice-badge">Existing Session Loaded (Editing In-Place)</span>
                    )}
                  </p>
                </div>

                <div className="quick-actions-row">
                  <button type="button" onClick={() => handleMarkAll("present")} className="btn-secondary">
                    All Present
                  </button>
                  <button type="button" onClick={() => handleMarkAll("absent")} className="btn-secondary">
                    All Absent
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAttendance}
                    disabled={savingAttendance || !currentSubject?.students?.length}
                    className="btn-primary"
                  >
                    {savingAttendance ? "Saving..." : isEditingExisting ? "Update Attendance" : "Submit Attendance"}
                  </button>
                </div>
              </div>

              {!currentSubject?.students || currentSubject.students.length === 0 ? (
                <div className="empty-state">No students enrolled in this course yet.</div>
              ) : (
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Roll No</th>
                        <th>Student Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Toggle Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSubject.students.map((st) => {
                        const isPresent = studentStatuses[st._id] === "present";
                        return (
                          <tr key={st._id} className={isPresent ? "row-present" : "row-absent"}>
                            <td><strong>{st.rollNo || "-"}</strong></td>
                            <td>{st.name}</td>
                            <td>{st.email}</td>
                            <td>
                              <span className={`status-pill ${isPresent ? "pill-present" : "pill-absent"}`}>
                                {isPresent ? "🟢 Present" : "🔴 Absent"}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(st._id)}
                                className={`btn-toggle ${isPresent ? "toggle-absent" : "toggle-present"}`}
                              >
                                Mark {isPresent ? "Absent" : "Present"}
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

          {/* TAB 2: SUBJECT SUMMARY & SHORTAGE */}
          {activeTab === "summary" && (
            <div className="card">
              {summaryLoading || !summaryData ? (
                <div className="loading-screen" style={{ height: "30vh" }}>
                  <div className="spinner"></div>
                  <p>Calculating attendance statistics...</p>
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
                                  <strong>{s.attendedClasses}</strong> / {s.totalClasses} Classes
                                </td>
                                <td>
                                  <span className={`pct-chip ${s.isShortage ? "pct-bad" : "pct-good"}`}>
                                    {s.percentage}%
                                  </span>
                                </td>
                                <td>
                                  {s.isShortage ? (
                                    <div className="shortage-notice">
                                      <span>⚠️ Shortage (&lt;75%)</span>
                                      <small>Must attend next <strong>{s.classesNeededTo75}</strong> consecutive class(es)</small>
                                    </div>
                                  ) : (
                                    <span className="good-standing">✅ Good Standing</span>
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
        </div>
      )}
    </div>
  );
}
