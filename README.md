# FixFlow — Smart Complaint & Maintenance Management System

FixFlow is a production-grade full-stack MERN application engineered to streamline maintenance workflows across residential communities, corporate offices, educational campuses, and facilities management organizations.

---

## 📌 Project Overview

FixFlow replaces chaotic, informal reporting methods (WhatsApp threads, verbal complaints, sticky notes) with a structured, transparent, and auditable maintenance lifecycle:
- **Tenants / Staff:** Submit structured incident reports with category, location, and priority; track real-time resolution progress.
- **Facilities Administrators:** Triage requests, prioritize tickets, and dispatch work orders to qualified technicians.
- **Maintenance Technicians:** Manage assigned work orders, update job status (In Progress, On Hold, Resolved), and log repair notes.

---

## 🛠️ Technology Stack

| Layer | Technology | Key Capabilities |
| :--- | :--- | :--- |
| **Frontend** | React.js (v18+) with Vite | Lightning-fast HMR, clean component structure, modular styling. |
| **Styling** | Vanilla CSS Design System | Custom CSS variables for tokens, responsive layouts, accessible contrast. |
| **Backend** | Node.js & Express.js | RESTful JSON API, modular middleware architecture, centralized error handling. |
| **Database** | MongoDB with Mongoose ODM | Document-oriented schema validation, compound indexes, lean queries. |
| **Authentication** | JWT & Bcrypt | Stateless token authorization and role-based access control (RBAC). |
| **Testing** | Vitest + React Testing Library / Supertest / Playwright | Frontend unit/component tests, backend HTTP integration tests, & browser E2E test suites. |

---

## 📁 Repository Structure

```
FixFlow/
├── client/                     # Frontend React + Vite application
│   ├── e2e/                    # Playwright browser end-to-end tests
│   └── playwright.config.js    # Playwright configuration
├── server/                     # Backend Node.js + Express REST API
│   └── tests/                  # Integration and unit test suites
├── docs/                       # Comprehensive architectural & technical docs
│   ├── 01-project-overview.md
│   ├── 02-problem-statement.md
│   ├── 03-requirements.md
│   ├── 04-system-architecture.md
│   ├── 05-database-design.md
│   ├── 06-api-documentation.md
│   ├── 07-setup-guide.md
│   ├── 08-testing-guide.md
│   ├── 09-deployment-guide.md
│   └── 10-troubleshooting.md
├── .gitignore                  # Git ignore rules for Node, Vite, env, & OS artifacts
└── README.md                   # Project overview & roadmap
```

---

## 📖 Project Documentation Index

Detailed specifications and architectural decisions are documented in the [`docs/`](./docs) directory:

1. [01 — Project Overview](./docs/01-project-overview.md) — Mission, roles, and core principles.
2. [02 — Problem Statement & Solution](./docs/02-problem-statement.md) — Failure points in maintenance and how FixFlow resolves them.
3. [03 — Requirements Specification](./docs/03-requirements.md) — Functional and non-functional requirements, state transitions.
4. [04 — System Architecture](./docs/04-system-architecture.md) — Topology, folder layout, request lifecycle, and security model.
5. [05 — Database Design](./docs/05-database-design.md) — Mongoose schemas, collection relationships, and indexing.
6. [06 — API Documentation](./docs/06-api-documentation.md) — REST endpoint specifications, request/response contracts.
7. [07 — Local Setup Guide](./docs/07-setup-guide.md) — Prerequisites, environment templates, and running dev servers.
8. [08 — Testing Guide](./docs/08-testing-guide.md) — QA standards, backend integration tests, component testing, and Playwright E2E suites.
9. [09 — Deployment Guide](./docs/09-deployment-guide.md) — Production build procedures and hosting checklists.
10. [10 — Troubleshooting Guide](./docs/10-troubleshooting.md) — Common error resolution for MongoDB, CORS, and ports.

---

## 🚀 Phased Implementation Roadmap

- [x] **Phase 0 — Project Initiation & Architecture:** Inspect workspace, establish directory skeleton, prepare complete architectural blueprints.
- [x] **Phase 1 — Backend Foundation:** Initialize `server/package.json`, database connection, centralized error handling, environment validation, health check, and route not found middleware.
- [x] **Phase 2 — Auth & RBAC:** Implement User model, bcrypt hashing, JWT token issuance, auth/role middleware, register/login/me/logout endpoints, and 34 automated unit/integration tests.
- [x] **Phase 3 — Core Complaints API & Work Orders:** Implement complaint schemas, collision-safe ticket numbers (`FIX-YYYYMM-XXXX`), role-scoped list filters, admin technician dispatch, workflow state machine transitions, immutable activity history logs, and 79 automated tests across 27 suites.
- [x] **Phase 4 — Frontend Foundation & Design System:** Initialize Vite React app, establish plain CSS design token system, develop reusable accessible components (`Button`, `Input`, `Select`, `Textarea`, `Card`, `StatusBadge`, `PageHeader`, `LoadingState`, `EmptyState`, `ErrorState`, `Modal`), responsive application shell (`Sidebar`, `Header`, `AppLayout`), initial pages (`Login`, `Register`, `UserDashboard`, `ComplaintList`, `ComplaintDetail`, `CreateComplaint`, `AdminDashboard`, `TechnicianDashboard`, `NotFound`), centralized API client with token interception, and 26 automated component/route tests.
- [x] **Phase 5 — Client Features & Dedicated Portals:** Connect React frontend to actual backend APIs across User, Technician, and Admin portals. Implemented dynamic technician loading (`GET /api/v1/auth/technicians`) for admin dispatch, full complaint creation with nested location subdocument, bounded pagination, multi-attribute filtering, complaint detail inspection with audit timeline, priority calibration, technician work order lifecycle status machine, modal accessibility enhancements, and 44 Vitest tests across 11 suites.
- [x] **Phase 6 — End-to-End Testing & Quality Assurance:** Implement complete 10-step multi-role lifecycle workflow tests (User ➔ Admin dispatch ➔ Technician repair ➔ User verification & feedback), author Playwright browser automation suites, implement genuine resolution feedback & rating API (`POST /api/v1/complaints/:id/feedback`) with 1-to-1 idempotency, enforce authorization and negative security bounds, verify accessibility (ARIA, visible focus, keyboard trap), and achieve 148 automated tests across all tiers with a 100% pass rate.
- [x] **Phase 7 — Final Verification and Bug Fixes:** Audit dependency vulnerabilities, resolve Vitest and Playwright test file collisions, verify backend integration and frontend components, execute Playwright browser automation tests against local Vite server, verify production build, document local runbook, known limitations, and remaining production security prerequisites.

---

## ⚡ Quickstart & Execution Runbook

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **MongoDB:** v6.0 or higher (or MongoDB Atlas connection string)
- **Playwright Chromium:** Run `npx playwright install chromium` inside `client/`

### 1. Environment Setup
Never place real secrets in version control. Create configuration files from templates:

```bash
# Server configuration:
cp server/.env.example server/.env

# Client configuration:
cp client/.env.example client/.env
```

### 2. Running FixFlow Locally

```bash
# Terminal 1 — Start Backend Server (http://localhost:5000):
cd server
npm install
npm run dev      # Or 'npm run dev:watch' for zero-dependency watch mode

# Terminal 2 — Start Frontend Client (http://localhost:5173):
cd client
npm install
npm run dev
```

### 3. Verification & Test Commands

```bash
# Run all backend unit & integration tests (97 tests):
cd server && npm test

# Run all frontend component tests (46 tests):
cd client && npm test

# Run frontend linter:
cd client && npm run lint

# Compile frontend production bundle:
cd client && npm run build

# Run Playwright browser end-to-end tests:
cd client && npm run test:e2e
```

---

## ⚠️ Known Limitations & Remaining Security Issues

- **Development Tool Vulnerability:** `npm audit` in `server/` reports high-severity `braces` vulnerability via `nodemon`'s dependency `chokidar`. `nodemon` is strictly a development utility (`devDependencies`) not included in production. Fix via `npm audit fix --force` would downgrade nodemon to 1.14.10 (breaking change). Alternatively, `npm run dev:watch` uses native Node 18+ watch without third-party tools.
- **Production Secrets:** `JWT_SECRET` in `.env` must be replaced with a high-entropy 64-character hex key prior to production deployment.
- **Transport Security:** Production deployment requires HTTPS termination to encrypt JWT Bearer tokens in transit.
- **CORS Allowlist:** Ensure `CLIENT_URL` matches the exact production frontend domain.

---

## 🚦 Current Status
*Phase 7 (Final Verification and Bug Fixes) is complete and fully verified. The full-stack FixFlow system functions reliably across the React client, Express API, and MongoDB data models. 148 automated tests pass with 100% success rate (97 backend integration/unit tests across 32 suites + 46 frontend component tests across 11 suites + 5 Playwright browser end-to-end tests across 1 suite), and the frontend compiles cleanly for production in under 2.5 seconds.*
