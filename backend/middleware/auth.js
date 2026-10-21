const jwt = require("jsonwebtoken");

/**
 * Authentication Middleware
 * Verifies JWT token from 'Authorization: Bearer <token>' header or cookies
 */
const auth = (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No authentication token provided."
      });
    }

    const secret = process.env.JWT_SECRET || "supersecretjwtkey_attendance_system_2026";
    const decoded = jwt.verify(token, secret);

    // Attach decoded user data (userId, role, name) to request object
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please log in again."
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid token. Authentication failed."
    });
  }
};

/**
 * Role-Based Authorization Middleware
 * Usage: authorizeRoles("admin", "teacher")
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User information not found."
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource. Required roles: ${allowedRoles.join(", ")}`
      });
    }

    next();
  };
};

module.exports = {
  auth,
  authorizeRoles
};
