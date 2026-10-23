# 06 — REST API Documentation

## 1. API Architecture & Standards

- **Base URL:** `/api/v1`
- **Transport:** HTTPS
- **Payload Format:** `application/json`
- **Authentication Scheme:** `Bearer <JWT_TOKEN>` in `Authorization` header.

### Standard Response Envelopes

Every API endpoint responds with a standardized top-level JSON structure.

#### Success Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 10,
    "totalCount": 42,
    "totalPages": 5
  }
}
```

#### Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters provided.",
    "details": [
      {
        "field": "title",
        "issue": "Title must be at least 5 characters in length."
      }
    ]
  }
}
```

---

## 2. Authentication & User Management Endpoints

### `POST /api/v1/auth/register`
Creates a new user account.
- **Access:** Public
- **Security Rule:** Public registration strictly forces `role: "user"`. Any client-supplied privileged role is ignored to prevent privilege escalation.
- **Password Policy:** Minimum 8 characters, maximum 128 characters, with at least one letter and one number.
- **Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "password": "SecurePassword123!"
}
```
- **Responses:**
  - `201 Created`: User created successfully, returns JWT token and safe user profile (excluding passwordHash):
    ```json
    {
      "success": true,
      "message": "User registered successfully",
      "data": {
        "user": {
          "id": "651a7b8e4f1c9a0012345678",
          "name": "Jane Doe",
          "email": "jane.doe@example.com",
          "role": "user",
          "isActive": true,
          "createdAt": "2026-10-23T08:30:00.000Z",
          "updatedAt": "2026-10-23T08:30:00.000Z"
        },
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
    ```
  - `400 Bad Request`: Validation failure (short name, invalid email, weak password).
  - `409 Conflict`: Email address already registered (`EMAIL_ALREADY_EXISTS`).

---

### `POST /api/v1/auth/login`
Authenticates credentials and issues a signed JWT.
- **Access:** Public
- **Security Rule:** Returns generic `"Invalid email or password."` on both non-existent emails and incorrect passwords to prevent account enumeration.
- **Request Body:**
```json
{
  "email": "jane.doe@example.com",
  "password": "SecurePassword123!"
}
```
- **Responses:**
  - `200 OK`: Returns JWT token and safe user profile:
    ```json
    {
      "success": true,
      "message": "Login successful",
      "data": {
        "user": {
          "id": "651a7b8e4f1c9a0012345678",
          "name": "Jane Doe",
          "email": "jane.doe@example.com",
          "role": "user",
          "isActive": true
        },
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
    ```
  - `400 Bad Request`: Missing email or password.
  - `401 Unauthorized`: Invalid credentials (`INVALID_CREDENTIALS`).
  - `403 Forbidden`: Account deactivated (`ACCOUNT_DEACTIVATED`).

---

### `GET /api/v1/auth/me`
Retrieves currently authenticated user's profile from the validated token session.
- **Access:** Authenticated (Any active role)
- **Headers:** `Authorization: Bearer <token>`
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "user": {
          "id": "651a7b8e4f1c9a0012345678",
          "name": "Jane Doe",
          "email": "jane.doe@example.com",
          "role": "user",
          "isActive": true,
          "createdAt": "2026-10-23T08:30:00.000Z",
          "updatedAt": "2026-10-23T08:30:00.000Z"
        }
      }
    }
    ```
  - `401 Unauthorized`: Missing token, invalid token signature, or expired token (`TOKEN_EXPIRED`).

---

### `POST /api/v1/auth/logout`
Client-directed session termination.
- **Access:** Public
- **Architectural Note:** FixFlow uses stateless JWTs. Tokens contain cryptographic signatures that validate client identity without database lookups on every request. Therefore, server-side logout does not magically "revoke" an already-issued stateless token; the client application must discard the token from memory or `localStorage`.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Logged out successfully. Stateless session ended; client must discard the token."
    }
    ```

---

### `GET /api/v1/auth/technicians`
Retrieves a list of all active technicians for assignment and triage workflows.
- **Access:** Restricted (Administrator only: `role === 'admin'`)
- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:** None
- **Responses:**
  - `200 OK`: Returns an array of active technician profiles (excluding password hashes):
    ```json
    {
      "success": true,
      "data": {
        "technicians": [
          {
            "id": "651a7b8e4f1c9a0011223344",
            "name": "Tom Fixer",
            "email": "tom@fixflow.com",
            "role": "technician",
            "isActive": true
          }
        ]
      }
    }
    ```
  - `401 Unauthorized`: Missing or invalid JWT.
  - `403 Forbidden`: User does not possess the `admin` role.

---

### `GET /api/v1/auth/admin-check`
Test endpoint demonstrating role authorization for administrators.
- **Access:** Authenticated (`admin` role required)
- **Headers:** `Authorization: Bearer <admin_token>`
- **Responses:**
  - `200 OK`: Admin access verified.
  - `403 Forbidden`: Non-admin role attempting access (`FORBIDDEN`).

---

### `GET /api/v1/auth/technician-check`
Test endpoint demonstrating role authorization for field technicians and administrators.
- **Access:** Authenticated (`technician` or `admin` role required)
- **Headers:** `Authorization: Bearer <technician_token>`
- **Responses:**
  - `200 OK`: Technician access verified.
  - `403 Forbidden`: Standard user attempting access (`FORBIDDEN`).

---

## 3. Complaint Management & Work Order Endpoints

> [!NOTE]
> **Scope Notice:** FixFlow is currently configured for single-organization operation. All authenticated accounts operate within the shared facility management scope. Multi-tenant organizational isolation is a planned future enhancement.

### `POST /api/v1/complaints`
Logs a new maintenance complaint.
- **Access:** Authenticated (`user`, `admin`)
- **Server Rule:** `complaintNumber` is generated atomically via a database-backed sequence (`FIX-YYYYMM-XXXX`). `createdBy` is strictly set from the verified token. Initial status is always `submitted`.
- **Request Body:**
```json
{
  "title": "Air conditioning blowing warm air in Room 302",
  "category": "hvac",
  "priority": "high",
  "location": {
    "building": "Tower B",
    "floor": "3",
    "room": "302",
    "description": "Near south window"
  },
  "description": "The AC unit runs loudly but produces only ambient warm air. Room temperature is over 28°C."
}
```
- **Responses:**
  - `201 Created`:
    ```json
    {
      "success": true,
      "message": "Complaint submitted successfully.",
      "data": {
        "complaint": {
          "id": "651a7b8e4f1c9a0099999999",
          "complaintNumber": "FIX-202610-0001",
          "title": "Air conditioning blowing warm air in Room 302",
          "description": "The AC unit runs loudly but produces only ambient warm air. Room temperature is over 28°C.",
          "category": "hvac",
          "priority": "high",
          "status": "submitted",
          "location": {
            "building": "Tower B",
            "floor": "3",
            "room": "302",
            "description": "Near south window"
          },
          "createdBy": "651a7b8e4f1c9a0012345678",
          "assignedTo": null,
          "assignedAt": null,
          "createdAt": "2026-10-23T08:45:00.000Z",
          "updatedAt": "2026-10-23T08:45:00.000Z"
        }
      }
    }
    ```
  - `400 Bad Request`: Validation failure (short title, invalid category, missing location).

---

### `GET /api/v1/complaints`
Retrieves a paginated list of complaints.
- **Access:** Authenticated (Role-scoped visibility):
  - `user`: Can **only** see complaints they created (`createdBy == req.user.id`).
  - `technician`: Can **only** see complaints assigned to them (`assignedTo == req.user.id`).
  - `admin`: Can view all organizational complaints.
- **Query Parameters:**
  - `page`: positive integer (default: 1)
  - `limit`: positive integer between 1 and 50 (default: 10, strictly capped at 50)
  - `status`: optional filter (`submitted`, `assigned`, `in_progress`, `on_hold`, `resolved`, `closed`, `rejected`)
  - `category`: optional filter (`electrical`, `plumbing`, `hvac`, `carpentry`, `appliance`, `safety_security`, `other`)
  - `priority`: optional filter (`low`, `medium`, `high`, `urgent`)
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "complaints": [ ... ]
      },
      "meta": {
        "page": 1,
        "limit": 10,
        "totalCount": 14,
        "totalPages": 2
      }
    }
    ```
  - `400 Bad Request`: Invalid pagination or filter parameters.

---

### `GET /api/v1/complaints/:id`
Retrieves full details for a single complaint.
- **Access:** Authenticated (Creator, Assigned Technician, or Admin)
- **Responses:**
  - `200 OK`: Full complaint document populated with `createdBy` and `assignedTo`.
  - `400 Bad Request`: Invalid MongoDB ObjectId format (`INVALID_IDENTIFIER`).
  - `403 Forbidden`: Unauthorized user attempting to access a complaint they did not create and are not assigned to (`FORBIDDEN`).
  - `404 Not Found`: Complaint ID does not exist (`COMPLAINT_NOT_FOUND`).

---

### `PATCH /api/v1/complaints/:id`
Updates permitted general complaint fields.
- **Access:** Authenticated:
  - `user`: Can only update their own complaints while in `submitted` status.
  - `admin`: Can update title, description, category, priority, and location.
  - `technician`: Disallowed (must use the `/status` endpoint for workflow updates).
- **Protected Fields:** Cannot update `complaintNumber`, `status`, `assignedTo`, or `createdBy` via this endpoint.
- **Request Body:**
```json
{
  "title": "Air conditioning blowing warm air in Room 302 (Urgent Update)",
  "priority": "urgent",
  "note": "Computer servers in room are overheating."
}
```
- **Responses:**
  - `200 OK`: Returns updated complaint.
  - `400 Bad Request`: Validation failure or attempted modification of protected fields.
  - `403 Forbidden`: Non-owner attempting edit or user attempting edit on non-submitted ticket.

---

### `POST /api/v1/complaints/:id/assign`
Assigns a field technician to a complaint.
- **Access:** Authenticated (`admin` only)
- **Server Rule:** Validates that `technicianId` points to an active user with `role: "technician"`. Automatically transitions `submitted` complaints to `assigned`. Logs an `ASSIGNMENT_CHANGED` audit record.
- **Request Body:**
```json
{
  "technicianId": "651a7b8e4f1c9a0012345680",
  "note": "Assigned to Senior HVAC Specialist Dave."
}
```
- **Responses:**
  - `200 OK`: Returns complaint with status `assigned` and `assignedTo` populated.
  - `400 Bad Request`: Invalid technician ID, or target user is deactivated / not a technician (`INVALID_TECHNICIAN`).
  - `403 Forbidden`: Non-admin user attempting assignment.
  - `404 Not Found`: Complaint not found.

---

### `POST /api/v1/complaints/:id/status`
Transitions complaint status through the validated business state machine.
- **Access:** Authenticated (Actor permissions enforced based on state machine):
  - `assigned` -> `in_progress`: Assigned Technician or Admin
  - `in_progress` -> `on_hold`: Assigned Technician or Admin (requires note)
  - `in_progress` -> `resolved`: Assigned Technician or Admin (requires resolution note)
  - `on_hold` -> `in_progress`: Assigned Technician or Admin
  - `resolved` -> `closed`: Complaint Creator User or Admin (confirmation)
  - `resolved` -> `in_progress`: Complaint Creator User or Admin (reopen, requires note)
  - `closed` -> `in_progress`: Admin only (reopen, requires note)
  - `submitted`/`assigned` -> `rejected`: Admin only (requires note)
- **Request Body:**
```json
{
  "status": "resolved",
  "note": "Replaced faulty thermal expansion valve and recharged coolant. AC verified cooling to 20°C."
}
```
- **Responses:**
  - `200 OK`: Returns updated complaint with timestamped resolution details.
  - `400 Bad Request`: Invalid transition, missing required note, or unassigned technician attempting action (`INVALID_STATUS_TRANSITION`).
  - `404 Not Found`: Complaint not found.

---

### `GET /api/v1/complaints/:id/history`
Retrieves the immutable chronological audit log for a complaint.
- **Access:** Authenticated (Creator, Assigned Technician, or Admin)
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "complaintId": "651a7b8e4f1c9a0099999999",
        "history": [
          {
            "action": "CREATED",
            "actor": { "name": "Jane Doe", "email": "jane@example.com", "role": "user" },
            "note": "Complaint submitted by requester.",
            "timestamp": "2026-10-23T08:45:00.000Z"
          },
          {
            "action": "ASSIGNMENT_CHANGED",
            "actor": { "name": "Admin Alice", "email": "admin@example.com", "role": "admin" },
            "note": "Assigned to Senior HVAC Specialist Dave.",
            "timestamp": "2026-10-23T09:00:00.000Z"
          },
          {
            "action": "STATUS_CHANGED",
            "actor": { "name": "Tech Dave", "email": "dave@example.com", "role": "technician" },
            "note": "Arrived on site and inspected unit.",
            "timestamp": "2026-10-23T09:30:00.000Z"
          },
          {
            "action": "RESOLVED",
            "actor": { "name": "Tech Dave", "email": "dave@example.com", "role": "technician" },
            "note": "Replaced expansion valve. Air flowing cold.",
            "timestamp": "2026-10-23T10:15:00.000Z"
          }
        ]
      }
    }
    ```
  - `403 Forbidden`: Unauthorized user attempting access.
  - `404 Not Found`: Complaint not found.

---

### `POST /api/v1/complaints/:id/feedback`
Submits resolution feedback and quality rating for a resolved or closed complaint.
- **Access:** Authenticated (Complaint Creator only)
- **Lifecycle Prerequisite:** Complaint must be in `resolved` or `closed` status. Submitting on open or unassigned tickets is rejected.
- **Enforcement:** Enforces strict 1-to-1 submission policy per complaint. Once submitted, duplicate submissions return `409 Conflict`.
- **Audit Logging:** Automatically logs a `FEEDBACK_SUBMITTED` entry into the complaint's immutable history log with star rating and actor identity.
- **Request Body:**
```json
{
  "rating": 5,
  "comments": "The technician arrived promptly, diagnosed the issue quickly, and resolved the AC cooling problem cleanly."
}
```
- **Field Constraints:**
  - `rating`: Required integer from `1` to `5` (inclusive).
  - `comments`: Optional string up to `500` characters.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Feedback submitted successfully.",
      "data": {
        "complaint": {
          "id": "651a7b8e4f1c9a0099999999",
          "complaintNumber": "CMP-2026-0001",
          "status": "resolved",
          "feedback": {
            "rating": 5,
            "comments": "The technician arrived promptly, diagnosed the issue quickly, and resolved the AC cooling problem cleanly.",
            "submittedAt": "2026-10-23T10:30:00.000Z"
          }
        },
        "feedback": {
          "rating": 5,
          "comments": "The technician arrived promptly, diagnosed the issue quickly, and resolved the AC cooling problem cleanly.",
          "submittedAt": "2026-10-23T10:30:00.000Z"
        }
      }
    }
    ```
  - `400 Bad Request`: Rating outside 1-5, comments exceeding length, or complaint not yet resolved/closed (`INVALID_FEEDBACK` / `STATUS_NOT_ELIGIBLE`).
  - `403 Forbidden`: Non-creator user (e.g. administrator or technician) attempting to submit feedback (`FORBIDDEN`).
  - `404 Not Found`: Complaint not found.
  - `409 Conflict`: Feedback has already been recorded for this ticket (`FEEDBACK_ALREADY_EXISTS`).

---

---

## 4. Technician & Admin Metrics Endpoints

### `GET /api/v1/technicians`
Returns list of active technicians and their current workload.
- **Access:** Authenticated (`ADMIN`)
- **Responses:**
  - `200 OK`: List of technicians with their specialization and count of active work orders.

---

### `GET /api/v1/technicians/work-orders`
Retrieves tickets assigned to the logged-in technician.
- **Access:** Authenticated (`TECHNICIAN`)
- **Responses:**
  - `200 OK`: Paginated list of assigned work orders sorted by priority.

---

### `GET /api/v1/admin/stats`
Computes operational performance indicators directly from database collections.
- **Access:** Authenticated (`ADMIN`)
- **Responses:**
  - `200 OK`:
```json
{
  "success": true,
  "data": {
    "totalTickets": 128,
    "statusCounts": {
      "submitted": 14,
      "assigned": 18,
      "inProgress": 22,
      "onHold": 4,
      "resolved": 12,
      "closed": 58
    },
    "urgentCount": 3,
    "averageResolutionHours": 18.5
  }
}
```
