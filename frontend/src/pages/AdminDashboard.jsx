import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function AdminDashboard() {
  const { token, user } = useAuth();

  // Stats & Data State
  const [stats, setStats] = useState({ studentCount: 0, teacherCount: 0, subjectCount: 0 });
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Alerts
  const [alert, setAlert] = useState({ type: "", message: "" });

  // Form State: Create Subject
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");

  // Edit Subject Modal State
  const [editingSubject, setEditingSubject] = useState(null);
  const [editName, setEditName] = useState("");
  const [editTeacher, setEditTeacher] = useState("");

  // Enrollment Modal State
  const [activeEnrollSubject, setActiveEnrollSubject] = useState(null);
  const [selectedStudentToEnroll, setSelectedStudentToEnroll] = useState("");

  // Helper for authenticated requests
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

  // Fetch all initial data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, subjectsRes, teachersRes, studentsRes] = await Promise.all([
        authFetch("/api/auth/stats"),
        authFetch("/api/subjects"),
        authFetch("/api/auth/users?role=teacher"),
        authFetch("/api/auth/users?role=student")
      ]);

      const [statsData, subjectsData, teachersData, studentsData] = await Promise.all([
        statsRes.json(),
        subjectsRes.json(),
        teachersRes.json(),
        studentsRes.json()
      ]);

      if (statsData.success) setStats(statsData.stats);
      if (subjectsData.success) setSubjects(subjectsData.subjects);
      if (teachersData.success) {
        setTeachers(teachersData.users);
        if (teachersData.users.length > 0) setSelectedTeacher(teachersData.users[0]._id);
      }
      if (studentsData.success) {
        setStudents(studentsData.users);
        if (studentsData.users.length > 0) setSelectedStudentToEnroll(studentsData.users[0]._id);
      }
    } catch (err) {
      setAlert({ type: "error", message: "Failed to load dashboard data." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Create Subject
  const handleCreateSubject = async (e) => {
    e.preventDefault();
    setAlert({ type: "", message: "" });

    if (!name.trim() || !code.trim() || !selectedTeacher) {
      setAlert({ type: "error", message: "Please provide subject name, course code, and assigned teacher." });
      return;
    }

    try {
      setActionLoading(true);
      const res = await authFetch("/api/subjects", {
        method: "POST",
        body: JSON.stringify({ name, code, teacher: selectedTeacher })
      });
      const data = await res.json();

      if (res.ok) {
        setAlert({ type: "success", message: `Subject '${data.subject.name}' created successfully!` });
        setName("");
        setCode("");
        loadDashboardData();
      } else {
        setAlert({ type: "error", message: data.message || "Failed to create subject." });
      }
    } catch (err) {
      setAlert({ type: "error", message: "Network error creating subject." });
    } finally {
      setActionLoading(false);
    }
  };

  // Edit Subject
  const handleUpdateSubject = async (e) => {
    e.preventDefault();
    if (!editingSubject) return;

    try {
      setActionLoading(true);
      const res = await authFetch(`/api/subjects/${editingSubject._id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName, teacher: editTeacher })
      });
      const data = await res.json();

      if (res.ok) {
        setAlert({ type: "success", message: "Subject updated successfully!" });
        setEditingSubject(null);
        loadDashboardData();
      } else {
        setAlert({ type: "error", message: data.message || "Failed to update subject." });
      }
    } catch (err) {
      setAlert({ type: "error", message: "Error updating subject." });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Subject
  const handleDeleteSubject = async (subjectId, subjectName) => {
    if (!window.confirm(`Are you sure you want to delete '${subjectName}'? This will also remove all its attendance records.`)) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await authFetch(`/api/subjects/${subjectId}`, { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        setAlert({ type: "success", message: "Subject deleted successfully." });
        loadDashboardData();
      } else {
        setAlert({ type: "error", message: data.message || "Failed to delete subject." });
      }
    } catch (err) {
      setAlert({ type: "error", message: "Error deleting subject." });
    } finally {
      setActionLoading(false);
    }
  };

  // Enroll Student
  const handleEnrollStudent = async (e) => {
    e.preventDefault();
    if (!activeEnrollSubject || !selectedStudentToEnroll) return;

    try {
      setActionLoading(true);
      const res = await authFetch(`/api/subjects/${activeEnrollSubject._id}/enroll`, {
        method: "POST",
        body: JSON.stringify({ studentIds: [selectedStudentToEnroll] })
      });
      const data = await res.json();

      if (res.ok) {
        setActiveEnrollSubject(data.subject);
        setAlert({ type: "success", message: "Student enrolled successfully!" });
        loadDashboardData();
      } else {
        setAlert({ type: "error", message: data.message || "Failed to enroll student." });
      }
    } catch (err) {
      setAlert({ type: "error", message: "Error enrolling student." });
    } finally {
      setActionLoading(false);
    }
  };

  // Unenroll Student
  const handleUnenrollStudent = async (studentId) => {
    if (!activeEnrollSubject) return;

    try {
      setActionLoading(true);
      const res = await authFetch(`/api/subjects/${activeEnrollSubject._id}/unenroll`, {
        method: "POST",
        body: JSON.stringify({ studentId })
      });
      const data = await res.json();

      if (res.ok) {
        setActiveEnrollSubject(data.subject);
        setAlert({ type: "success", message: "Student unenrolled." });
        loadDashboardData();
      } else {
        setAlert({ type: "error", message: data.message || "Failed to unenroll student." });
      }
    } catch (err) {
      setAlert({ type: "error", message: "Error unenrolling student." });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading Admin Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Top Banner */}
      <div className="dashboard-header-card card">
        <div className="header-badge-row">
          <span className="role-badge role-admin">Admin Dashboard</span>
        </div>
        <h2>Academic Administration</h2>
        <p>Welcome, {user?.name}. Manage subjects, faculty assignments, and student rosters.</p>
      </div>

      {alert.message && (
        <div className={`alert ${alert.type === "error" ? "alert-error" : "alert-success"}`}>
          {alert.message}
        </div>
      )}

      {/* Real-time Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">📚</span>
          <div className="stat-details">
            <h3>{stats.subjectCount}</h3>
            <p>Active Subjects</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">👨‍🏫</span>
          <div className="stat-details">
            <h3>{stats.teacherCount}</h3>
            <p>Faculty Members</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🎓</span>
          <div className="stat-details">
            <h3>{stats.studentCount}</h3>
            <p>Enrolled Students</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Create Subject & Subjects List */}
      <div className="admin-content-grid">
        {/* Create Subject Card */}
        <div className="card">
          <h3>Create New Subject</h3>
          <p className="card-subtitle">Define course code, title, and assign faculty.</p>

          <form onSubmit={handleCreateSubject} className="dashboard-form">
            <div className="form-group">
              <label htmlFor="subName">Subject Title *</label>
              <input
                id="subName"
                type="text"
                placeholder="e.g. Distributed Systems"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="subCode">Course Code *</label>
              <input
                id="subCode"
                type="text"
                placeholder="e.g. CS401"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="teacherSelect">Assign Teacher *</label>
              <select
                id="teacherSelect"
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="form-select"
                required
              >
                {teachers.length === 0 ? (
                  <option value="">No teachers registered yet</option>
                ) : (
                  teachers.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.department || "Faculty"})
                    </option>
                  ))
                )}
              </select>
            </div>

            <button type="submit" className="btn-primary" disabled={actionLoading || teachers.length === 0}>
              {actionLoading ? "Creating..." : "Create Subject"}
            </button>
          </form>
        </div>

        {/* Subjects List Card */}
        <div className="card">
          <h3>All Registered Subjects ({subjects.length})</h3>
          <p className="card-subtitle">Manage assignments, rosters, and course offerings.</p>

          {subjects.length === 0 ? (
            <div className="empty-state">No subjects registered yet. Create one using the form.</div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Subject</th>
                    <th>Teacher</th>
                    <th>Students</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((sub) => (
                    <tr key={sub._id}>
                      <td><strong>{sub.code}</strong></td>
                      <td>{sub.name}</td>
                      <td>{sub.teacher?.name || "Unassigned"}</td>
                      <td>
                        <span className="count-chip">{sub.students?.length || 0}</span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            onClick={() => {
                              setActiveEnrollSubject(sub);
                            }}
                            className="btn-action btn-manage"
                            title="Manage Student Roster"
                          >
                            Roster
                          </button>
                          <button
                            onClick={() => {
                              setEditingSubject(sub);
                              setEditName(sub.name);
                              setEditTeacher(sub.teacher?._id || "");
                            }}
                            className="btn-action btn-edit"
                            title="Edit Subject"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSubject(sub._id, sub.name)}
                            className="btn-action btn-delete"
                            title="Delete Subject"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Subject Modal */}
      {editingSubject && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Edit Subject: {editingSubject.code}</h3>
            <form onSubmit={handleUpdateSubject} className="dashboard-form">
              <div className="form-group">
                <label>Subject Title</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Assign Teacher</label>
                <select
                  value={editTeacher}
                  onChange={(e) => setEditTeacher(e.target.value)}
                  className="form-select"
                >
                  {teachers.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Student Roster Modal */}
      {activeEnrollSubject && (
        <div className="modal-overlay">
          <div className="modal-card modal-large">
            <div className="modal-header">
              <div>
                <h3>Roster: {activeEnrollSubject.name} ({activeEnrollSubject.code})</h3>
                <p>Enrolled Students: {activeEnrollSubject.students?.length || 0}</p>
              </div>
              <button onClick={() => setActiveEnrollSubject(null)} className="btn-close">✕</button>
            </div>

            {/* Enroll New Student Form */}
            <form onSubmit={handleEnrollStudent} className="enroll-bar-form">
              <select
                value={selectedStudentToEnroll}
                onChange={(e) => setSelectedStudentToEnroll(e.target.value)}
                className="form-select"
              >
                {students
                  .filter((s) => !activeEnrollSubject.students?.some((es) => es._id === s._id))
                  .map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.rollNo || s.email})
                    </option>
                  ))}
              </select>
              <button type="submit" className="btn-primary" disabled={actionLoading || students.length === 0}>
                + Enroll Student
              </button>
            </form>

            {/* Currently Enrolled Students List */}
            <div className="enrolled-students-list">
              {activeEnrollSubject.students?.length === 0 ? (
                <div className="empty-state">No students enrolled yet. Select a student above to enroll them.</div>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Roll No</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEnrollSubject.students.map((st) => (
                      <tr key={st._id}>
                        <td><strong>{st.rollNo || "-"}</strong></td>
                        <td>{st.name}</td>
                        <td>{st.email}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleUnenrollStudent(st._id)}
                            className="btn-action btn-delete"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
