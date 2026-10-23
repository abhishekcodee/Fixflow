# 01 — Project Overview: FixFlow

## Project Name
**FixFlow — Smart Complaint & Maintenance Management System**

## Status
- **Current Phase:** Phase 0 — Architecture & Initial Planning
- **Implementation Status:** Architectural foundation and documentation created. Codebase implementation pending subsequent phases.

---

## 1. Executive Summary
In institutional settings such as corporate offices, residential housing communities, and university campuses, maintenance reporting often suffers from friction, lack of transparency, and lost accountability. Requests are routinely routed through informal channels—such as disparate WhatsApp chats, informal verbal notes, or unmonitored email inboxes. Consequently:
- Critical issues go untracked or duplicate reports occur.
- Technicians lack clear context, priority levels, and location details before arriving on site.
- Facility managers lack real-time visibility into workload distribution and SLA (Service Level Agreement) compliance.
- End-users (tenants, employees, students) feel neglected because they receive no real-time status updates on their reported issues.

**FixFlow** is a modern full-stack web application designed to solve this breakdown. It standardizes complaint intake, organizes automated and manual work order dispatch, tracks technician resolution steps, and provides end-to-end auditability.

---

## 2. Target Roles & User Personas

| Role | Primary User Persona | Core Tasks & Needs |
| :--- | :--- | :--- |
| **User (Resident / Employee / Student)** | Occupant reporting a fault | Submits complaints with location and category; tracks ticket progress; receives status updates; adds notes/feedback upon resolution. |
| **Administrator (Facilities Manager)** | Operations Lead | Reviews incoming tickets; assigns appropriate technicians; sets priorities and SLAs; monitors open backlogs; views real-time status. |
| **Technician (Field Specialist)** | Electrician, Plumber, HVAC Tech | Views personalized work order queue; updates status (e.g., In Progress, Awaiting Parts, Resolved); logs internal repair notes and completion timestamps. |

---

## 3. Technology Stack & Technical Rationale

FixFlow utilizes the **MERN** stack (MongoDB, Express, React, Node.js) paired with modern tooling:

### Frontend
- **Framework & Build Tool:** **React.js (v18+) with Vite**
  - *Why:* Vite provides instant Hot Module Replacement (HMR) and optimized ES-module bundling, ensuring a fast development experience without the overhead of legacy bundlers. React's component-based model enables clean separation of UI concerns.
- **Styling:** **Modular Vanilla CSS**
  - *Why:* Strict adherence to custom CSS custom properties (design tokens) for colors, spacing, typography, and clean layouts. This prevents heavy third-party framework churn, avoids bloated bundle sizes, and ensures deep control over accessibility, responsive breakpoints, and professional SaaS aesthetics.
- **Testing:** **Vitest & React Testing Library**
  - *Why:* Vitest shares the same configuration and transformation pipeline as Vite, executing component unit and integration tests rapidly.

### Backend
- **Runtime & Framework:** **Node.js with Express.js**
  - *Why:* A lightweight, non-blocking, asynchronous runtime with a battle-tested HTTP server abstraction. Express middleware architecture allows modular authentication, request validation, error handling, and rate limiting.
- **Database & ODM:** **MongoDB with Mongoose**
  - *Why:* Flexible document model naturally suited for hierarchical complaint tickets, timeline events, and polymorphic attributes, while Mongoose provides schema validation, type casting, middleware hooks, and indexes.
- **Testing:** **Node Test Runner / Jest with Supertest**
  - *Why:* Allows testing of HTTP endpoints, authorization headers, validation failures, and database transactions without running a manual server instance.

---

## 4. System High-Level Boundaries

```
[ Web Browser Client ]
        │  (HTTPS / JSON REST API)
        ▼
[ Express.js REST API Server ]
   ├── Authentication Middleware (JWT validation, RBAC)
   ├── Input Validation & Sanitization (Express-Validator / Zod)
   ├── Route Controllers & Domain Services
   └── Centralized Error Handling Layer
        │
        ▼
[ MongoDB Database (Mongoose ODM) ]
   ├── Users Collection
   ├── Complaints Collection
   ├── WorkOrders Collection
   └── AuditLogs Collection
```

---

## 5. Core Architectural Principles
1. **Separation of Concerns:** Controllers handle HTTP transport logic; services encapsulate business logic; data models enforce schema integrity.
2. **Defensive API Design:** Never trust input from the client. Every incoming payload is validated and sanitized before reaching domain logic.
3. **Role-Based Access Control (RBAC):** Permissions are strictly enforced at the backend route level. Frontend UI hiding is purely for user experience, never for security.
4. **Transparent Audit Trail:** Every status change on a complaint or work order captures who made the change, when it occurred, and an optional explanatory note.
5. **No Synthetic/Fake Analytics:** All metrics displayed in dashboards reflect actual database queries, never hardcoded dummy values.
