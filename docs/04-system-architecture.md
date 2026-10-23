# 04 — System Architecture & Design

## 1. Architectural Topology Overview

FixFlow follows a **decoupled Client-Server architecture** communicating over a RESTful JSON API.

```
┌────────────────────────────────────────────────────────┐
│                   CLIENT APPLICATION                   │
│        React.js (Vite) + Modular CSS Design System     │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ User Portal  │  │ Tech Console │  │ Admin Panel  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │          │
│         └─────────────────┼─────────────────┘          │
│                           │                            │
│                 [ Axios / Fetch Client ]               │
│               (Auth Header / Token Storage)            │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / REST (JSON)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   BACKEND API SERVER                   │
│               Node.js + Express.js Framework           │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Global Middleware: CORS, Helmet, JSON Parser    │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Auth Guard (JWT Verify) + RBAC Role Evaluator    │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Route Input Validation (Zod / Express-Validator) │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Route Controllers (HTTP Transport & DTOs)        │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Domain Service Layer (Business Logic & Workflow) │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Central Error Handler (Consistent JSON Envelopes)│  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │ Mongoose ODM Driver
                            ▼
┌────────────────────────────────────────────────────────┐
│                   PERSISTENCE LAYER                    │
│                        MongoDB                         │
│                                                        │
│   [users]      [complaints]     [audit_logs]           │
└────────────────────────────────────────────────────────┘
```

---

## 2. Client Architecture (Frontend)

The frontend is organized by technical role and feature domain to guarantee maintainability:

```
client/
├── public/                # Static assets, favicon, manifest
├── src/
│   ├── assets/            # Project SVGs, icons, illustrations
│   ├── components/        # Reusable UI elements
│   │   ├── common/        # Buttons, Inputs, Modals, Badges, Loaders, Alerts
│   │   ├── layout/        # Navbar, Sidebar, PageContainer, Footer
│   │   └── complaints/    # ComplaintCard, ComplaintFilter, StatusTimeline
│   ├── context/           # React Context providers (AuthContext, ToastContext)
│   ├── hooks/             # Custom React hooks (useAuth, useFetch, useDebounce)
│   ├── pages/             # Route-level view components
│   │   ├── auth/          # Login, Register
│   │   ├── user/          # UserDashboard, NewComplaint, ComplaintDetail
│   │   ├── technician/    # TechnicianWorkOrders, WorkOrderDetail
│   │   └── admin/         # AdminOverview, TicketDispatch, ManageUsers
│   ├── services/          # HTTP API client modules (api.js, authService.js, complaintService.js)
│   ├── styles/            # Design system tokens and global styles
│   │   ├── variables.css  # CSS custom properties (colors, typography, spacing, shadows)
│   │   ├── base.css       # Resets, HTML elements, typographic scale
│   │   └── utilities.css  # Utility classes (flex, grid, spacing, container)
│   ├── utils/             # Formatters, date helpers, validation schemas
│   ├── App.jsx            # Top-level routing & layout wrapper
│   └── main.jsx           # Application entry point
├── index.html             # HTML entry template
├── vite.config.js         # Vite bundler configuration
└── package.json           # Dependencies and scripts
```

### State Management Philosophy:
- **Server State vs. UI State:** Client state is strictly partitioned.
  - *Authentication & Session:* Managed through a lightweight `AuthContext` with persistent storage in `localStorage` or `sessionStorage`.
  - *Data Fetching & Mutations:* Managed via localized component hooks with explicit loading, error, and empty states. We avoid bloated state managers (like Redux) since the domain flow does not require complex cross-tree synchronization.

---

## 3. Server Architecture (Backend)

The server enforces strict layer isolation so HTTP concerns do not leak into database logic:

```
server/
├── src/
│   ├── config/            # Database connection, environment variables validator
│   ├── controllers/       # HTTP request handlers (parsing params, sending JSON)
│   ├── middleware/        # Authentication, Authorization, Validation, Error Handling
│   ├── models/            # Mongoose schemas and model definitions
│   ├── routes/            # REST API route definitions
│   ├── services/          # Pure business logic and database interactions
│   ├── utils/             # Custom AppError class, logger, async handler
│   ├── app.js             # Express application setup (middleware, routes)
│   └── server.js          # HTTP server bootstrap & graceful shutdown hooks
├── tests/                 # Integration and unit tests
└── package.json           # Backend dependencies and scripts
```

### The Request-Response Pipeline:
1. **Security & Parsing:** `helmet` sets HTTP defense headers, `cors` restricts origins, `express.json({ limit: '1mb' })` safely parses bodies.
2. **Authentication Guard:** Verifies JWT from the `Authorization: Bearer <token>` header, decodes user credentials, and attaches `req.user`.
3. **RBAC Guard:** Compares `req.user.role` with allowed roles for the specific endpoint. Rejects with `403 Forbidden` if unauthorized.
4. **Validation Guard:** Validates request payload schema. Rejects with `400 Bad Request` and structured field errors if invalid.
5. **Controller:** Extracts inputs, calls corresponding service method.
6. **Service:** Executes business rules, queries Mongoose models, records audit events.
7. **Response Envelope:** Returns predictable JSON format `{ success: true, data: ... }`.
8. **Error Middleware:** Catches unhandled rejections and known `AppError` instances, returning `{ success: false, error: { message, code, details } }`.

---

## 4. Security Architecture

### 4.1 Why Passwords Must Be Hashed
Plaintext passwords must never be stored, logged, or transmitted back to clients. FixFlow uses `bcryptjs` with 12 salt rounds:
- **One-Way Cryptographic Function:** A password cannot be reversed or decrypted back into plaintext.
- **Salt Generation:** A unique cryptographic salt is generated for every user password, ensuring two users with identical passwords yield completely distinct hashes. This defeats rainbow table attacks.
- **Adaptive Work Factor:** 12 rounds of key derivation deliberately introduce computation cost (approx. 200–300ms), making brute-force dictionary attacks infeasible while remaining fast for legitimate users.

### 4.2 How JSON Web Token (JWT) Verification Works
FixFlow adopts a stateless token strategy:
1. **Issuance:** Upon valid credentials, the server signs a token payload containing `{ id, role }` using HMAC-SHA256 (`HS256`) and a secret key (`JWT_SECRET`).
2. **Transmission:** The client stores the token and includes it in the HTTP `Authorization` header as `Bearer <token>` for all subsequent requests.
3. **Verification:** The `authenticate` middleware inspects the signature against `JWT_SECRET`. If any bit of the payload was tampered with, signature verification fails immediately.
4. **Expiration:** Tokens carry an `exp` claim. Expired tokens are rejected with HTTP 401 `TOKEN_EXPIRED`.

### 4.3 Authentication vs. Authorization (The Critical Distinction)
It is crucial not to conflate these two concepts:
- **Authentication (AuthN):** *"Who are you?"*
  - Verifies identity by confirming credentials or a valid cryptographically signed JWT.
  - Implemented in `authenticate` middleware.
- **Authorization (AuthZ):** *"What are you permitted to do?"*
  - Evaluates whether the identified user possesses the required privileges/role (`user`, `admin`, `technician`) to execute an action.
  - Implemented in `authorize(...roles)` middleware.
  - **Rule:** Authentication alone must never grant access to privileged administrative or technician operations.

### 4.4 Role-Based Access Control (RBAC) Matrix

| Route Group | User | Technician | Admin |
| :--- | :---: | :---: | :---: |
| `POST /api/auth/*` (Login, Register) | Public | Public | Public |
| `GET /api/complaints/my` | Allowed | Disallowed | Allowed |
| `POST /api/complaints` | Allowed | Disallowed | Allowed |
| `GET /api/complaints` (All complaints) | Disallowed | Disallowed | Allowed |
| `PATCH /api/complaints/:id/assign` | Disallowed | Disallowed | Allowed |
| `GET /api/technicians/work-orders` | Disallowed | Allowed | Allowed |
| `PATCH /api/complaints/:id/status` | Disallowed | Allowed (assigned only) | Allowed |
| `GET /api/admin/metrics` | Disallowed | Disallowed | Allowed |
