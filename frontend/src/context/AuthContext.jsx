import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("attendance_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem("attendance_token") || null;
  });

  const [loading, setLoading] = useState(true);

  // Verify token and fetch fresh user profile on initial load
  useEffect(() => {
    async function verifyAuth() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          localStorage.setItem("attendance_user", JSON.stringify(data.user));
        } else {
          // Token expired or invalid -> log out
          logout();
        }
      } catch (err) {
        console.error("Auth verification failed:", err);
      } finally {
        setLoading(false);
      }
    }

    verifyAuth();
  }, [token]);

  // Login handler
  const login = async (email, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, message: data.message || "Login failed" };
      }

      // Store in localStorage & state
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("attendance_token", data.token);
      localStorage.setItem("attendance_user", JSON.stringify(data.user));

      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, message: "Network error. Please try again." };
    }
  };

  // Register handler
  const register = async (userData) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData)
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, message: data.message || "Registration failed" };
      }

      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, message: "Network error. Please try again." };
    }
  };

  // Logout handler
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("attendance_token");
    localStorage.removeItem("attendance_user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
