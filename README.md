# Class Attendance Management System

A full-stack role-based Attendance Management System built with **React (Vite)**, **Node.js**, **Express.js**, and **MongoDB (Mongoose)**. The application implements secure JWT authentication, bcrypt password hashing, role authorization (Admin, Teacher, Student), multiple daily class slots, in-place attendance editing, and automatic calculation of attendance shortage (< 75%) along with the exact number of consecutive classes required to recover to 75%.

---

## Tech Stack & Architecture

- **Frontend**: React 19, React Router v7, Vite, Native CSS (responsive design system with dark modern styling)
- **Backend**: Node.js, Express.js REST API
- **Database**: MongoDB with Mongoose ODM (supports local MongoDB and MongoDB Atlas)
- **Authentication**: JSON Web Tokens (JWT) stored in client state / localStorage and HTTP Bearer tokens
- **Security**: Bcrypt password hashing, route-level role-based authorization middleware

---

## Project Structure

```
attendance-system/
├── backend/
│   ├── config/
│   │   └── db.js                 # MongoDB connection logic
│   ├── middleware/
│   │   └── auth.js               # JWT auth & authorizeRoles middleware
│   ├── models/
│   │   ├── User.js               # User schema (Admin, Teacher, Student)
│   │   ├── Subject.js            # Subject schema with teacher & student refs
│   │   └── Attendance.js         # Attendance schema with compound unique index
│   ├── routes/
│   │   ├── auth.routes.js        # Register, login, me, stats, user lists
│   │   ├── subject.routes.js     # Subject CRUD & student enrollment
│   │   └── attendance.routes.js  # Mark/edit attendance, summaries, shortage
│   ├── test/
│   │   ├── test-stage1.js        # Stage 1: Models & DB compound index tests
│   │   ├── test-stage2.js        # Stage 2: Auth, JWT & role protection tests
│   │   └── test-stage3.js        # Stage 3: Subject CRUD & attendance API tests
│   ├── .env.example              # Template for environment variables
│   ├── package.json              # Backend scripts and dependencies
│   ├── seed.js                   # Demo database seeder
│   └── server.js                 # Express application entrypoint
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx        # Role-aware navigation header
│   │   │   └── ProtectedRoute.jsx# Role guard component
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Global auth state & token persistence
│   │   ├── pages/
│   │   │   ├── Login.jsx         # Login form with role redirection
│   │   │   ├── Register.jsx      # Multi-role registration form
│   │   │   ├── AdminDashboard.jsx# Admin stats, subject CRUD, enrollment
│   │   │   ├── TeacherDashboard.jsx # Teacher roster, marking, summary & shortage
│   │   │   └── StudentDashboard.jsx # Student course attendance & shortage alert
│   │   ├── App.jsx               # Routes configuration
│   │   ├── index.css             # Unified modern CSS design system
│   │   └── main.jsx              # React DOM entry point
│   ├── test-stage4.cjs           # Stage 4: Auth flow & route guard tests
│   ├── test-stage5.cjs           # Stage 5: Role dashboards test suite
│   ├── test-stage6-e2e.cjs       # Stage 6: E2E flows, edge cases & security tests
│   ├── vite.config.js            # Vite config with backend API proxy
│   └── package.json              # Frontend scripts and dependencies
│
├── .gitignore                    # Root gitignore protecting secrets & builds
└── README.md                     # Complete project documentation
```

---

## Environment Configuration

In the `backend/` directory, create a `.env` file (copied from `.env.example`):

```bash
cp backend/.env.example backend/.env
```

Set your environment variables in `backend/.env`:

```env
PORT=5001
# Local MongoDB:
MONGO_URI=mongodb://127.0.0.1:27017/attendance_db
# Or MongoDB Atlas:
# MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/attendance_db?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key_here
```

> **Note**: Port `5001` is used by default to prevent port conflicts with macOS ControlCenter on port `5000`.

---

## Installation & Setup

### 1. Backend Setup

```bash
cd backend
npm install
```

### 2. Frontend Setup

```bash
cd ../frontend
npm install
```

---

## Database Seeding (Demo Data)

To populate the database with ready-to-use sample accounts, subjects, and attendance records:

```bash
cd backend
npm run seed
```

### Demo Accounts Created:

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@demo.attendance.edu` | `Password123!` | Department: Administration |
| **Teacher** | `turing@demo.attendance.edu` | `Password123!` | Assigned Subject: CS101-DEMO |
| **Student** | `aman@demo.attendance.edu` | `Password123!` | Roll No: `CS-2026-001` (100% Attendance) |
| **Student** | `sneha@demo.attendance.edu` | `Password123!` | Roll No: `CS-2026-002` (50% Attendance Shortage) |

---

## Running the Application Locally

### 1. Start the Backend Server

```bash
cd backend
npm run dev
# Server will run on http://localhost:5001
```

### 2. Start the Frontend Development Server

```bash
cd frontend
npm run dev
# Frontend will run on http://localhost:5173
```

Access the application in your browser at `http://localhost:5173`.

---

## Role-Based Features

### 1. Administrator Dashboard (`/admin`)
- **Real-Time Analytics**: View active counts for enrolled students, faculty members, and courses.
- **Subject CRUD**: Create courses with custom codes, course names, and assigned faculty; edit course information; delete courses (with automatic cascading attendance cleanup).
- **Student Enrollment**: Add students to courses or unenroll students through the interactive course roster modal.

### 2. Teacher Dashboard (`/teacher`)
- **Assigned Courses**: Automatically filters and displays only the courses assigned to the logged-in teacher.
- **Date & Slot Selector**: Choose any attendance date and class slot (`Slot 1`, `Slot 2`, etc.).
- **Attendance Marking**: Interactive roster with single-click Present/Absent toggle badges, as well as "Mark All Present" and "Mark All Absent" shortcuts.
- **In-Place Editing & Duplicate Prevention**: If attendance was already submitted for a specific subject, date, and slot, the system automatically loads the recorded statuses and updates existing records in-place (`findOneAndUpdate` with upsert) without creating duplicate entries.
- **Course Summary & Shortage Monitoring**: View aggregate statistics (total sessions held, enrolled count, students below 75%), search student attendance, and toggle a shortage filter to highlight students below 75%.

### 3. Student Dashboard (`/student`)
- **Personal Course Overview**: Displays all subjects in which the student is enrolled.
- **Attendance Metrics**: Shows total classes held, attended classes, and attendance percentage with progress bars.
- **75% Shortage Alert**: Prominently highlights courses where attendance is $< 75\%$ and calculates the exact number of consecutive classes required to reach 75%.
  - Shortage formula: $\text{Shortage} = (\text{Total Classes} > 0 \land \text{Percentage} < 75)$
  - Consecutive classes formula: $\max(0, 3T - 4A)$, where $T$ = total classes held and $A$ = attended classes.
- **Date-Wise Session History**: Expandable history showing each session's date, class slot, and Present/Absent status.

---

## API Endpoints Reference

### Authentication Routes (`/api/auth`)
- `POST /api/auth/register` - Register a new user (`name`, `email`, `password`, `role`, `rollNo`, `department`).
- `POST /api/auth/login` - Authenticate user & return JWT token.
- `GET /api/auth/me` - Get profile of currently authenticated user.
- `GET /api/auth/stats` - Admin-only endpoint returning counts of students, teachers, and subjects.
- `GET /api/auth/users?role=:role` - Get list of users filtered by role.

### Subject Routes (`/api/subjects`)
- `POST /api/subjects` - Admin creates a subject (`name`, `code`, `teacher`).
- `GET /api/subjects` - Retrieve subjects (Admin sees all; Teachers see assigned subjects; Students see enrolled subjects).
- `GET /api/subjects/:id` - Get details of a single subject.
- `PUT /api/subjects/:id` - Admin updates a subject.
- `DELETE /api/subjects/:id` - Admin deletes a subject (with cascading cleanup of attendance records).
- `POST /api/subjects/:id/enroll` - Admin enrolls student IDs (`{ studentIds: [...] }`).
- `POST /api/subjects/:id/unenroll` - Admin unenrolls a student (`{ studentId: "..." }`).

### Attendance Routes (`/api/attendance`)
- `POST /api/attendance/mark` - Teacher marks or updates attendance (`subjectId`, `date`, `slot`, `records: [{ studentId, status }]`).
- `GET /api/attendance/subject/:subjectId?date=...&slot=...` - Get attendance records for a specific date and slot.
- `GET /api/attendance/summary/subject/:subjectId` - Get subject attendance summary, percentages, and shortage calculations.
- `GET /api/attendance/shortage/subject/:subjectId` - Get only students below 75% attendance for a subject.
- `GET /api/attendance/student/me` - Logged-in student's personal attendance report across all enrolled subjects.

---

## Running the Automated Test Suite

All test suites connect to the configured test database and execute automated tests:

### Backend Test Suites (Stages 1–3)
```bash
cd backend
# Run individual stage test:
npm run test:stage1    # Models, validation & compound unique index
npm run test:stage2    # Auth, JWT, bcrypt hashing & role middleware
npm run test:stage3    # Subject CRUD & attendance APIs

# Or run all backend tests sequentially:
npm test
```

### Frontend & E2E Test Suites (Stages 4–6)
```bash
cd frontend
# Stage 4 Frontend Auth & Route Protection:
npm test

# Stage 5 Role-Based Dashboards & UI Contracts:
node test-stage5.cjs

# Stage 6 End-to-End Flows, Edge Cases & Security:
node test-stage6-e2e.cjs
```

---

## Production Build

To validate or build the frontend production assets:

```bash
cd frontend
npm run build
```

Production assets are compiled to `frontend/dist/`.
