import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          🎓 <span>AttendanceHub</span>
        </Link>

        <div className="nav-links">
          {isAuthenticated && user ? (
            <div className="nav-user-info">
              <span className={`role-badge role-${user.role}`}>
                {user.role.toUpperCase()}
              </span>
              <span className="user-name">{user.name}</span>
              <button onClick={handleLogout} className="btn-logout">
                Logout
              </button>
            </div>
          ) : (
            <div className="nav-auth-links">
              <Link to="/login" className="nav-link">
                Login
              </Link>
              <Link to="/register" className="btn-primary-small">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
