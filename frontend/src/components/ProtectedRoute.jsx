import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Verifying authentication...</p>
      </div>
    );
  }

  // If not logged in, redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // If specific roles are required, verify user's role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to their own role dashboard
    const roleRedirect = `/${user.role}`;
    return <Navigate to={roleRedirect} replace />;
  }

  return children;
}
