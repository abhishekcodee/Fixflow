# FixFlow — Smart Complaint & Maintenance Management System

<div align="center">

[![Live Demo on Vercel](https://img.shields.io/badge/Live%20Frontend-fixflow--bdhv.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://fixflow-bdhv.vercel.app)
[![Backend REST API on Render](https://img.shields.io/badge/Backend%20API-fixflowwww.onrender.com-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://fixflowwww.onrender.com)
[![Database](https://img.shields.io/badge/Database-TiDB%20Cloud%20(MySQL)-FF6A00?style=for-the-badge&logo=mysql&logoColor=white)](https://tidbcloud.com)
[![CI Build Status](https://img.shields.io/github/actions/workflow/status/abhishekcodee/Fixflow/ci.yml?branch=main&style=for-the-badge&label=CI%20Build)](https://github.com/abhishekcodee/Fixflow/actions)

</div>

### 🌐 Live Production Deployments

| Component | Provider | Live URL | Status |
| :--- | :--- | :--- | :--- |
| **Frontend Application** | **Vercel** | [https://fixflow-bdhv.vercel.app](https://fixflow-bdhv.vercel.app) | ![Ready](https://img.shields.io/badge/Status-Ready-brightgreen) |
| **Backend REST API** | **Render** | [https://fixflowwww.onrender.com](https://fixflowwww.onrender.com) | ![Online](https://img.shields.io/badge/Status-Online-brightgreen) |
| **API Health Check** | **Render** | [https://fixflowwww.onrender.com/api/v1/health](https://fixflowwww.onrender.com/api/v1/health) | ![Healthy](https://img.shields.io/badge/Health-200%20OK-brightgreen) |
| **Database** | **TiDB Cloud** | Serverless MySQL Cluster (`gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000`) | ![Connected](https://img.shields.io/badge/TiDB-Connected-brightgreen) |

---

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
| **Frontend** | React.js (v18+) with Vite | Lightning-fast HMR, clean component structure, modular styling. Deployed on **Vercel**. |
| **Styling** | Vanilla CSS Design System | Custom CSS variables for tokens, responsive layouts, accessible contrast. |
| **Backend** | Node.js & Express.js | RESTful JSON API, modular middleware architecture, centralized error handling. Deployed on **Render**. |
| **Database** | TiDB Cloud (MySQL-Compatible) with Prisma ORM | Relational schema integrity, foreign keys, compound indexes, type-safe queries. |
| **Authentication** | Gmail SMTP OTP & JWT | 5-step email OTP verification, password creation, stateless token authorization, and RBAC. |
| **Testing** | Vitest + React Testing Library / Supertest | Frontend unit/component tests, backend HTTP integration tests, and 100% pass rate. |

---

## 📁 Repository Structure

```
FixFlow/
├── client/                     # Frontend React + Vite application (Vercel)
│   ├── e2e/                    # Playwright browser end-to-end tests
│   └── src/                    # Components, pages, context, and services
├── server/                     # Backend Node.js + Express REST API (Render)
│   ├── prisma/                 # Prisma schema & migrations (TiDB Cloud)
│   ├── src/                    # Controllers, models, routes, middleware
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
└── README.md                   # Project overview, live links & roadmap
```

---

## 📖 Project Documentation Index

Detailed specifications and architectural decisions are documented in the [`docs/`](./docs) directory:

1. [01 — Project Overview](./docs/01-project-overview.md) — Mission, roles, and core principles.
2. [02 — Problem Statement & Solution](./docs/02-problem-statement.md) — Failure points in maintenance and how FixFlow resolves them.
3. [03 — Requirements Specification](./docs/03-requirements.md) — Functional and non-functional requirements, state transitions.
4. [04 — System Architecture](./docs/04-system-architecture.md) — Topology, folder layout, request lifecycle, and security model.
5. [05 — Database Design](./docs/05-database-design.md) — Prisma schemas, relational tables, and indexing.
6. [06 — API Documentation](./docs/06-api-documentation.md) — REST endpoint specifications, request/response contracts.
7. [07 — Local Setup Guide](./docs/07-setup-guide.md) — Prerequisites, environment templates, and running dev servers.
8. [08 — Testing Guide](./docs/08-testing-guide.md) — QA standards, backend integration tests, component testing.
9. [09 — Deployment Guide](./docs/09-deployment-guide.md) — Production build procedures and hosting checklists.
10. [10 — Troubleshooting Guide](./docs/10-troubleshooting.md) — Common error resolution for TiDB Cloud, CORS, and ports.

---

## 🚀 Key Features

- **OTP-Based Registration Flow:** 5-step registration architecture with secure 6-digit numeric OTP sent via Gmail SMTP, verification token issuance, password validation, and direct persistence in TiDB Cloud.
- **Incident & Complaint Lifecycle:** Automatic complaint numbering (`FIX-YYYYMM-XXXX`), priority scoring, technician dispatching, status transitions (`submitted` ➔ `assigned` ➔ `in_progress` ➔ `resolved` ➔ `closed`), and audit history trail.
- **Role-Based Access Control (RBAC):** Dedicated workflows for `user` (resident/staff), `technician`, and `admin`.
- **Geographic Campus Radius Filter:** Spatial query filtering using Haversine formula for nearby complaints.
- **Centralized Error Handling:** Secure error formatting preventing stack leaks in production while giving actionable diagnostics.

---

## ⚡ Quickstart & Execution Runbook

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **MySQL / TiDB Cloud:** Serverless MySQL connection string

### 1. Environment Setup
Create configuration files from templates:

```bash
# Server configuration:
cp server/.env.example server/.env

# Client configuration:
cp client/.env.example client/.env
```

### 2. Running FixFlow Locally

#### Unified Dev Server:
```bash
npm run dev          # Automatically spins up Express backend (:5000) and Vite frontend (:5173)
```

#### Separate Terminals:
```bash
# Terminal 1 — Start Backend Server (http://localhost:5000):
cd server && npm run dev

# Terminal 2 — Start Frontend Client (http://localhost:5173):
cd client && npm run dev
```

### 3. Verification & Test Commands

```bash
# Run all backend unit & integration tests (133 tests):
cd server && npm test

# Run all frontend component tests:
cd client && npm test

# Compile frontend production bundle:
cd client && npm run build
```

---

## 🚦 Production Status
- **Frontend:** Live on Vercel at [https://fixflow-bdhv.vercel.app](https://fixflow-bdhv.vercel.app)
- **Backend:** Live on Render at [https://fixflowwww.onrender.com](https://fixflowwww.onrender.com)
- **Database:** Live on TiDB Cloud Serverless (MySQL Compatible)
- **Continuous Integration:** 100% automated test pass rate across all test suites.
