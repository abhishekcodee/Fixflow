# 03 — Software Requirements Specification (SRS)

## 1. Functional Requirements (FR)

### 1.1 Authentication & Authorization Module
- **FR-AUTH-01:** System must allow new users to register with full name, email, password, and contact phone number.
- **FR-AUTH-02:** Passwords must be hashed using `bcrypt` (minimum 10 salt rounds) prior to database persistence. Plaintext passwords must never be stored or logged.
- **FR-AUTH-03:** System must allow registered users to authenticate via email and password, returning a secure JSON Web Token (JWT).
- **FR-AUTH-04:** API endpoints must enforce Role-Based Access Control (RBAC) via middleware:
  - `ROLE_USER`: Standard requester (can only view and create own complaints).
  - `ROLE_TECHNICIAN`: Service worker (can view assigned complaints and update status).
  - `ROLE_ADMIN`: Facility administrator (full access to assign, reassign, close, and configure).
- **FR-AUTH-05:** System must allow authenticated users to inspect their current session profile and logout safely.

### 1.2 Complaint Reporting Module (User / Requester)
- **FR-COMP-01:** Users must be able to log a complaint with the following fields:
  - Title (10–100 characters)
  - Category (Enum: `ELECTRICAL`, `PLUMBING`, `HVAC`, `CARPENTRY`, `APPLIANCE`, `SAFETY_SECURITY`, `OTHER`)
  - Location (Building, Floor, Room / Unit designation)
  - Priority (User-requested: `LOW`, `MEDIUM`, `HIGH`, `URGENT`)
  - Description (20–1000 characters)
- **FR-COMP-02:** Upon submission, complaint receives status `SUBMITTED` and a timestamped audit log entry.
- **FR-COMP-03:** Users must be able to view a paginated list of complaints they have submitted.
- **FR-COMP-04:** Users must be able to view full details of their complaint, including technician assignments and timeline updates.
- **FR-COMP-05:** Users must be able to add user notes or confirm closure once a technician marks a ticket as `RESOLVED`.

### 1.3 Triage & Dispatch Module (Administrator)
- **FR-ADMIN-01:** Admins must view a comprehensive dashboard of all organizational complaints with status and category filters.
- **FR-ADMIN-02:** Admins must be able to adjust ticket priority (e.g., elevate `MEDIUM` to `URGENT`).
- **FR-ADMIN-03:** Admins must be able to assign a complaint to an active technician, automatically transitioning complaint status to `ASSIGNED`.
- **FR-ADMIN-04:** Admins must be able to reassign tickets if a technician is unavailable or on leave.
- **FR-ADMIN-05:** Admins must have access to operational summary counts: Total Tickets, Open/In-Progress, Resolved, Average Turnaround Time.

### 1.4 Work Order Management Module (Technician)
- **FR-TECH-01:** Technicians must have a dedicated view displaying only work orders assigned to them.
- **FR-TECH-02:** Technicians must be able to transition status:
  - From `ASSIGNED` -> `IN_PROGRESS` (indicating work has commenced on site).
  - From `IN_PROGRESS` -> `RESOLVED` (requires completion note and resolution timestamp).
  - From `IN_PROGRESS` -> `ON_HOLD` (requires reason, e.g., "Waiting for replacement capacitor").
- **FR-TECH-03:** Technicians can view user contact and location information to coordinate physical access.

---

## 2. Complaint Lifecycle & State Machine

Every complaint strictly adheres to the following state transitions:

```
[ SUBMITTED ]
      │
      ├──────────────────────┐ (Admin Rejection / Duplicate)
      ▼                      ▼
 [ ASSIGNED ]          [ REJECTED ]
      │
      ▼
[ IN_PROGRESS ] ◄───► [ ON_HOLD ] (Waiting for parts / approval)
      │
      ▼
 [ RESOLVED ]
      │
      ▼
  [ CLOSED ] (Finalized by Requester or Auto-closed by Admin)
```

### Transition Validation Rules:
1. `SUBMITTED` may transition to `ASSIGNED` or `REJECTED`.
2. `ASSIGNED` may transition to `IN_PROGRESS` or reassigned to another technician.
3. `IN_PROGRESS` may transition to `ON_HOLD` or `RESOLVED`.
4. `ON_HOLD` may transition back to `IN_PROGRESS`.
5. `RESOLVED` may transition to `CLOSED` or reopened to `IN_PROGRESS` if the requester flags inadequate resolution.
6. `REJECTED` and `CLOSED` are terminal states.

---

## 3. Non-Functional Requirements (NFR)

### 3.1 Security & Data Protection
- **NFR-SEC-01:** All API communications must be transmittable over TLS/HTTPS.
- **NFR-SEC-02:** Cross-Origin Resource Sharing (CORS) must be restricted to explicit origin whitelists in production.
- **NFR-SEC-03:** Request bodies must be sanitized to protect against NoSQL injection and XSS attacks.
- **NFR-SEC-04:** Standard HTTP security headers must be applied via `helmet`.
- **NFR-SEC-05:** Rate limiting must be implemented on sensitive routes (such as `/api/auth/login` and `/api/auth/register`) to prevent brute force credential abuse.

### 3.2 Performance & Responsiveness
- **NFR-PERF-01:** Database queries for complaint lists must be paginated (default: 10 items/page, maximum: 50 items/page) using indexed fields (`status`, `assignedTo`, `createdAt`).
- **NFR-PERF-02:** Frontend initial bundle load time target < 1.5 seconds on standard 4G connections.
- **NFR-PERF-03:** REST API endpoint response time under 150ms for 95th percentile requests (excluding cold database connections).

### 3.3 Usability, Layout & Accessibility
- **NFR-UI-01:** Design must be responsive across viewport widths from 360px (mobile) to 1920px (desktop monitors).
- **NFR-UI-02:** Color contrast ratios must meet WCAG 2.1 AA standard (minimum 4.5:1 for standard text).
- **NFR-UI-03:** All interactive controls (buttons, form inputs, links) must have distinct focus and hover states for keyboard accessibility.
- **NFR-UI-04:** Informative feedback (loading skeletons, clear error banners, explicit success toasts) must accompany all asynchronous actions.
