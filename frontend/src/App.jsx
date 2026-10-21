import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminDashboard from "./pages/AdminDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import "./index.css";

// Home redirector based on authentication status & role
function HomeRedirect() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading application...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={`/${user.role}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Navbar />
          <main className="main-content">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Role-Protected Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/teacher"
                element={
                  <ProtectedRoute allowedRoles={["teacher"]}>
                    <TeacherDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/student"
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <StudentDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Root redirect */}
              <Route path="/" element={<HomeRedirect />} />

              {/* Fallback 404 */}
              <Route
                path="*"
                element={
                  <div className="card text-center" style={{ margin: "40px auto", maxWidth: "500px" }}>
                    <h2>404 - Page Not Found</h2>
                    <p>The page you are looking for does not exist.</p>
                  </div>
                }
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
