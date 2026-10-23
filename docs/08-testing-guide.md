# 08 — Quality Assurance & Testing Guide

## 1. Testing Philosophy

FixFlow embraces an automated testing approach centered on **integration confidence**:
- **Unit Tests:** Pure helper functions, formatting utilities, and isolated validation schemas.
- **Backend Integration Tests:** HTTP endpoint testing with Supertest targeting route validation, authentication tokens, RBAC permissions, and database mutations.
- **Frontend Component Tests:** Testing component behavior from the user's perspective (accessible queries, form submissions, empty states, and loading indicators) rather than implementation details.

---

## 2. Backend Testing Strategy

### Stack & Tools
- **Test Framework:** Node.js Native Test Runner (`node --test`)
- **HTTP Assertions:** `supertest`
- **Isolation:** Fast, deterministic unit and integration test suites using mock boundaries and cryptographic assertions without external network dependencies.

### Primary Test Suites

#### 1. Validation Suite (`tests/unit/validation.test.js`)
- Validates password policy: min 8, max 128 chars, requires letter and number.
- Validates name length bounds and character rules.
- Validates RFC-compliant email address format.
- Validates multi-field failure collection for registration and login payloads.

#### 2. Security & Cryptography Suite (`tests/unit/security.test.js`)
- Verifies `bcryptjs` password hashing and salting (different hashes for identical inputs).
- Verifies password candidate matching and rejection of incorrect passwords.
- Validates `toSafeObject()` and `toJSON()` sanitization stripping `passwordHash`.
- Verifies JWT signing with claims (`id`, `role`), expiry decoding, and rejection of tampered/expired tokens.

#### 3. Auth & RBAC Integration Suite (`tests/integration/auth.test.js`)
- **Registration:**
  - Successful registration returns HTTP 201, safe user object, and signed token.
  - Public registration privilege escalation prevention (client-provided `role: 'admin'` is strictly overridden to `'user'`).
  - Duplicate email collision returns HTTP 409 `EMAIL_ALREADY_EXISTS`.
  - Malformed payload returns HTTP 400 with structured issue details.
- **Login:**
  - Valid credentials return HTTP 200 and token.
  - Non-existent user or bad password returns generic HTTP 401 `INVALID_CREDENTIALS`.
- **Identity & Protection (`GET /api/v1/auth/me`):**
  - Missing token returns HTTP 401 `UNAUTHORIZED`.
  - Tampered/invalid token returns HTTP 401 `INVALID_TOKEN`.
  - Expired token returns HTTP 401 `TOKEN_EXPIRED`.
  - Valid token returns HTTP 200 and safe profile without password hash.
- **Role-Based Authorization:**
  - Standard user accessing admin-only endpoint receives HTTP 403 `FORBIDDEN`.
  - Admin accessing admin-only endpoint receives HTTP 200 `OK`.
  - Standard user accessing technician endpoint receives HTTP 403 `FORBIDDEN`.
  - Technician accessing technician endpoint receives HTTP 200 `OK`.
- **Logout:**
  - Verifies HTTP 200 with clear stateless session guidance.

#### 4. Complaint Validation Suite (`tests/unit/complaint-validation.test.js`)
- Validates 24-character hex MongoDB ObjectIds (`isValidObjectId`).
- Enforces complaint creation rules: title length (5–120), description (min 10), valid category, and structured location.
- Enforces complaint update field protection (`validateUpdateComplaint` blocks unauthorized updates to `status`, `assignedTo`, `complaintNumber`, etc.).
- Verifies complaint status transition matrix (`validateStatusTransition`):
  - Requires active technician assignment to advance to `in_progress`.
  - Enforces mandatory resolution and on-hold notes.
  - Allows creators to confirm closure or reopen resolved tickets.
  - Rejects arbitrary or invalid status jumps (e.g., `submitted` directly to `resolved`).
  - Blocks transitions from terminal `rejected` states.
- Verifies bounded pagination and query filter extraction (max 50 limit).

#### 5. Counter & Ticket Sequence Suite (`tests/unit/counter-sequence.test.js`)
- Tests collision-safe atomic sequence generation partitioned by month: `FIX-YYYYMM-XXXX`.
- Validates timestamp-based fallback mechanism when the database counter is inaccessible.

#### 6. Complaint Lifecycle & Work Orders Suite (`tests/integration/complaint-lifecycle.test.js`)
- **Creation (`POST /api/v1/complaints`):**
  - Authenticated user submits complaint and receives HTTP 201 with generated `complaintNumber`, initial status `submitted`, and initial history log.
  - Client-supplied `createdBy`, `assignedTo`, and `status` overrides are securely stripped.
- **Role-Scoped List (`GET /api/v1/complaints`):**
  - Standard users can only view tickets they created (`createdBy: req.user.id`).
  - Technicians can only view work orders assigned to them (`assignedTo: req.user.id`).
  - Administrators view all organization complaints without automatic scoping.
  - Limits exceeding 50 are rejected with HTTP 400.
- **Single Item Authorization (`GET /api/v1/complaints/:id`):**
  - Requesters can view their own complaints; unrelated users are rejected with HTTP 403.
  - Malformed ObjectIds return HTTP 400; non-existent tickets return HTTP 404.
- **Admin Dispatch (`POST /api/v1/complaints/:id/assign`):**
  - Administrators assign an active technician, transitioning status to `assigned`.
  - Non-administrators attempting assignment receive HTTP 403 `FORBIDDEN`.
  - Target users without the `technician` role are rejected with HTTP 400.
- **Workflow State Machine (`POST /api/v1/complaints/:id/status`):**
  - Assigned technician transitions job from `assigned` to `in_progress`.
  - Unassigned technician attempting to mark a job `in_progress` is rejected with HTTP 400.
  - Technician marks job `resolved` with resolution notes.
  - Requester confirms resolution and closes ticket (`closed`).
  - Requester reopens unsatisfied ticket back to `in_progress` with an explanation note.
  - Invalid direct status transitions return HTTP 400.
- **Immutable Audit Trail (`GET /api/v1/complaints/:id/history`):**
  - Authenticated ticket owner and administrators retrieve the chronological history log.
  - Unrelated users are rejected with HTTP 403 `FORBIDDEN`.

### Backend Execution Commands
```bash
cd server

# Run all 79 automated tests across 27 suites
npm test

# Verify all source and test file syntax
npm run check
```

---

## 3. Frontend Testing Strategy

### Stack & Tools
- **Test Runner:** `Vitest`
- **DOM Environment:** `jsdom`
- **DOM Testing:** `@testing-library/react` and `@testing-library/jest-dom`
- **User Interactions:** `@testing-library/user-event` and `fireEvent`

### Primary Frontend Test Suites (26 Tests Across 6 Suites)

#### 1. Button Component Suite (`src/components/common/__tests__/Button.test.jsx`)
- Verifies default rendering, child contents, and semantic button classes.
- Tests click handler invocation when enabled.
- Asserts that disabled buttons prevent click event emission.
- Verifies loading spinner rendering, loading text substitution, and `aria-busy` attribute.
- Asserts variant (`primary`, `secondary`, `outline`, `danger`, `ghost`) and size (`sm`, `md`, `lg`) classes.

#### 2. Input Component Suite (`src/components/common/__tests__/Input.test.jsx`)
- Asserts semantic `<label>` to `<input>` association via `htmlFor` and `id`.
- Verifies visual asterisk and HTML5 `required` attribute.
- Tests accessible error message rendering with `role="alert"` and `aria-invalid="true"`.
- Verifies user typing and `onChange` event dispatch.
- Asserts helper text rendering when no error is present.

#### 3. StatusBadge Component Suite (`src/components/common/__tests__/StatusBadge.test.jsx`)
- Verifies complaint status badge rendering and class bindings (`submitted`, `in_progress`, `resolved`, etc.).
- Verifies priority badge rendering (`low`, `medium`, `high`, `urgent`).
- Asserts graceful fallback to neutral styling for unknown statuses.

#### 4. UI States & Feedback Suite (`src/components/common/__tests__/States.test.jsx`)
- **LoadingState:** Asserts `role="status"` and polite `aria-live` announcement.
- **EmptyState:** Asserts icon, title, description, and action button rendering.
- **ErrorState:** Asserts accessible `role="alert"` container, error message, and `onRetry` button click callback.
- **PageHeader:** Asserts `<h1>` heading level, subtitle, and action buttons.

#### 5. Sidebar Role-Specific Navigation Suite (`src/components/layout/__tests__/Sidebar.test.jsx`)
- Asserts user role sees standard navigation (Dashboard, My Complaints, Report Issue).
- Asserts technician role sees Assigned Work Orders and Technician Queue.
- Asserts administrator role sees Dispatch Console, All Complaints, and full operational navigation.

#### 6. Authentication & Form Validation Suite (`src/pages/__tests__/AuthForms.test.jsx`)
- **Login Form:**
  - Verifies email and password input elements.
  - Tests mandatory field validation preventing empty submissions.
  - Asserts email format validation rejecting malformed emails.
- **Register Form:**
  - Verifies full name, email, password, and password confirmation fields.
  - Enforces password length (min 8) and alphanumeric complexity rules.
  - Asserts password mismatch validation.

#### 7. AppRoutes & Navigation Suite (`src/routes/__tests__/AppRoutes.test.jsx`)
- Asserts `/login` route renders the Login page.
- Asserts `/register` route renders the Register page.
- Verifies `ProtectedRoute` intercepts unauthenticated navigation to `/dashboard` and redirects to `/login`.
- Asserts that unknown routes render the 404 NotFound page with recovery navigation buttons.

#### 8. Complaint Creation & Validation Suite (`src/pages/__tests__/CreateComplaint.test.jsx`)
- Validates mandatory fields on empty submit (title, description, category, building, floor).
- Validates minimum length constraints (title >= 5 chars, description >= 10 chars).
- Verifies successful submission and payload formatting sent to `complaintsApi.create`.
- Tests accessible error state banner when the backend rejects submission.

#### 9. Complaint List & Filtering Suite (`src/pages/__tests__/ComplaintList.test.jsx`)
- Verifies initial loading spinner display.
- Verifies table rendering with complaint numbers, titles, categories, priorities, and status badges.
- Verifies empty state banner when zero items are returned.
- Tests retry callback upon network failure.
- Verifies filter query parameter updates (status, category, search).

#### 10. Admin Triage & Dispatch Suite (`src/pages/__tests__/AdminDashboard.test.jsx`)
- Rejects access and displays unauthorized warning for non-admin accounts.
- Fetches unassigned complaints and active technicians via `authApi.getTechnicians()`.
- Opens dispatch modal, populates technician picker, and dispatches ticket with optional notes.

#### 11. Complaint Detail & Lifecycle Transitions Suite (`src/pages/__tests__/ComplaintDetail.test.jsx`)
- Renders ticket metadata, location subdocument, requester, and assigned technician.
- Displays chronological audit history timeline.
- Enables assigned technician to open status modal and transition ticket (`assigned` -> `in_progress`).
- Handles 404/API load errors with retry options.
- Verifies resolution feedback and 5-star rating submission and existing feedback rendering on resolved/closed tickets.

### Frontend Execution Commands
```bash
cd client

# Run all 46 frontend tests across 11 suites:
npm test

# Run tests in interactive watch mode:
npm run test:watch

# Build production bundle:
npm run build
```

---

## 4. End-to-End (E2E) Browser Testing (Playwright)

FixFlow uses **Playwright** for automated, browser-level end-to-end verification in Chromium. The E2E tests run against the live client application served by Vite, simulating real user actions across multiple browser sessions and roles.

### Complete Lifecycle Test Scenarios (`client/e2e/workflow.spec.js`)
1. **User Sign In:** Normal user (`alice@fixflow.com`) submits credentials, receives authenticated session, and lands on personal dashboard.
2. **Complaint Creation:** User completes complaint form with title, category, urgent priority, and nested physical location fields (`building`, `floor`, `roomOrUnit`, `additionalNotes`).
3. **Complaint Listing:** User navigates to complaint directory and confirms the ticket appears with status `submitted`.
4. **Admin Triage & Discovery:** Administrator (`admin@fixflow.com`) signs in, accesses the Admin Dispatch Console, and locates the submitted ticket.
5. **Technician Dispatch:** Administrator queries active technicians (`GET /api/v1/auth/technicians`), opens dispatch modal, assigns technician Tom, and adds dispatch instructions.
6. **Technician Work Queue:** Technician (`tech@fixflow.com`) signs in, views assigned work order, and inspects ticket location and details.
7. **Lifecycle State Transitions:** Technician advances complaint through permitted states:
   - `assigned` ➔ `in_progress` (starts job)
   - `in_progress` ➔ `resolved` (submits mandatory repair notes)
8. **Audit Trail Verification:** Both technician and user inspect chronological audit history timeline and confirm actor stamps and state transitions.
9. **User Verification & Ticket Closure:** User logs back in, verifies repair resolution, and closes the ticket.
10. **Resolution Feedback & 5-Star Rating:** User submits service satisfaction rating (1-5 stars) and review comments. Verified badge and star display appear on the complaint.

### Authorization & Negative Scenarios
- **Standard User Access Rejection:** User visiting `/admin` receives access denial screen and is redirected back to personal dashboard.
- **Unauthenticated Protection:** Direct visits to `/complaints` or `/dashboard` without token automatically redirect to `/login`.
- **Invalid Input Validation:** Form validation triggers accessible error messages without submitting invalid payloads to the API.

### E2E Execution Commands
```bash
cd client

# Install Playwright browser binaries (one-time setup):
npx playwright install chromium

# Run all Playwright E2E browser tests:
npm run test:e2e

# Run Playwright in interactive UI mode:
npx playwright test --ui
```

---

## 5. Test Database & Credentials Strategy

### Isolation Guarantees
- **Never Run Destructive Tests Against Production:** E2E and integration test runs operate either against isolated memory instances (Mongoose mock queries / MongoDB Memory Server) or an explicitly designated test database specified via `MONGODB_TEST_URI`.
- **Deterministic Test Data:** Tests generate timestamped unique identifiers and never rely on hardcoded production IDs or timing-based sleeps.
- **Stateless Tokens:** Mock JWTs are signed with test secrets and validated in memory. Production secrets must never be placed in `.env.test` or Vite client variables.

---

## 6. Troubleshooting Guide

| Issue | Likely Cause | Resolution |
| :--- | :--- | :--- |
| `Executable doesn't exist at .../chrome-win64` | Playwright browser binaries not installed | Run `npx playwright install chromium` inside the `client/` directory. |
| `strict mode violation: ... resolved to 2 elements` | Ambiguous text query in Playwright locator | Qualify the selector using `page.getByRole(...)` or add `.first()`. |
| `EADDRINUSE: 5173` | Vite dev server already running on port 5173 | Playwright automatically reuses existing servers via `reuseExistingServer: true`. If hung, terminate existing node processes. |
| `401 Unauthorized` in backend integration tests | Missing or expired Bearer token in headers | Generate fresh token via `signToken({ id, role })` before issuing Supertest requests. |

---

## 7. Quality Assurance Metrics & Status Summary

| Test Layer | Framework | Suites | Tests | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Backend Unit & Cryptography** | Node Native Test Runner | 15 | 45 | **100% Pass** |
| **Backend API & Lifecycle Integration** | Node Native Test Runner + Supertest | 17 | 52 | **100% Pass** |
| **Frontend Components & Auth Forms** | Vitest + React Testing Library + JSDOM | 11 | 46 | **100% Pass** |
| **Browser E2E Multi-Role Workflows** | Playwright (Chromium) | 1 | 5 | **100% Pass** |
| **Production Bundle Compilation** | Vite Build | — | — | **0 Errors (Clean)** |
| **Total Automated Tests** | | **44 suites** | **148 tests** | **100% Pass** |

---

## 8. Environment Setup & Execution Runbook

### Required Software
- **Node.js:** v18.0.0 or higher (v20+ recommended).
- **npm:** v9.0.0 or higher.
- **MongoDB:** v6.0 or higher (Local Community Server or MongoDB Atlas cluster).
- **Playwright Chromium:** Installed via `npx playwright install chromium` in `client/`.

### Environment Configuration
Never commit real secrets or production credentials to source control. Configure local environments from the provided templates:

1. **Backend Environment (`server/.env`):**
   ```bash
   cp server/.env.example server/.env
   ```
   Configure the following keys in `server/.env`:
   - `PORT=5000`
   - `NODE_ENV=development`
   - `MONGODB_URI=mongodb://localhost:27017/fixflow_dev`
   - `CLIENT_URL=http://localhost:5173`
   - `JWT_SECRET=<minimum_32_character_high_entropy_secret>`
   - `JWT_EXPIRES_IN=7d`

2. **Frontend Environment (`client/.env`):**
   ```bash
   cp client/.env.example client/.env
   ```
   Configure the following public API base URL:
   - `VITE_API_BASE_URL=http://localhost:5000/api/v1`

### Database Configuration & Test Isolation
- **Development Database:** Point `MONGODB_URI` to `mongodb://localhost:27017/fixflow_dev`.
- **Integration Test Isolation:** Backend integration tests use in-memory Mock Mongoose query fixtures and Supertest handlers, executing completely offline without modifying development or production records.
- **Dedicated Staging Database:** If testing against a live instance, provide an isolated URI such as `mongodb://localhost:27017/fixflow_test`. Never connect integration test runners to production collections.

### Commands to Run Applications

#### 1. Backend Server
```bash
cd server

# Development mode with nodemon:
npm run dev

# Development mode with native Node watch (zero external devDependencies):
npm run dev:watch

# Production start:
npm start

# Syntax & module validation:
npm run check
```

#### 2. Frontend Client
```bash
cd client

# Start Vite development server (http://localhost:5173):
npm run dev

# Preview production build locally:
npm run preview
```

### Complete Test Commands

| Target | Command | Purpose |
| :--- | :--- | :--- |
| **Backend Tests** | `cd server && npm test` | Runs all 97 backend unit and integration test suites. |
| **Frontend Tests** | `cd client && npm test` | Runs all 46 Vitest component, route, and unit tests. |
| **Frontend Lint** | `cd client && npm run lint` | Runs Oxlint linter across frontend codebase. |
| **Frontend Build** | `cd client && npm run build` | Compiles production assets with Vite. |
| **Browser E2E** | `cd client && npm run test:e2e` | Runs Playwright browser automation tests (headless Chromium). |
| **Interactive E2E**| `cd client && npx playwright test --ui` | Launches interactive Playwright UI runner with time travel. |

---

## 9. Known Limitations & Remaining Security Issues

### Known Limitations
1. **Dev-Only Dependency Vulnerability (`nodemon`):**
   - Running `npm audit` in `server/` flags a high-severity vulnerability in transitive dependency `braces` via `chokidar` via `nodemon`.
   - `nodemon` is strictly a development utility (`devDependencies`) and is never loaded in production (`NODE_ENV=production`).
   - Fix available via `npm audit fix --force` would downgrade nodemon to 1.14.10 (breaking change).
   - Alternatively, developers can use `npm run dev:watch` (`node --watch src/server.js`), which utilizes Node 18+'s native file watcher with zero third-party dependencies.
2. **Stateless JWT Invalidation:**
   - Stateless JWT tokens remain valid until expiration (`JWT_EXPIRES_IN=7d`) unless discarded by the client. Immediate server-side revocation would require a centralized token denylist (e.g. Redis).
3. **Database Transaction Fallback:**
   - Ticket sequence counter (`FIX-YYYYMM-XXXX`) utilizes atomic `findOneAndUpdate` with collision fallback, but multi-document ACID transactions require a MongoDB replica set.

### Remaining Security Prerequisites for Production Deployment
- **Cryptographic Secret Entropy:** `JWT_SECRET` must be set to a cryptographically strong 64-character hex string generated via `crypto.randomBytes(32).toString('hex')`.
- **SSL / HTTPS Termination:** All production traffic must pass through HTTPS (e.g. Cloudflare, Nginx, or AWS ALB) to safeguard authorization Bearer tokens in transit.
- **Strict CORS Origin:** Ensure `CLIENT_URL` matches the exact production domain and is not set to `*` or localhost.
- **Rate Limiting:** Add rate-limiting middleware (e.g., `express-rate-limit`) on public authentication endpoints (`/register`, `/login`) prior to opening public registration to protect against credential stuffing.

---

## 10. Actual Local Verification Results (Phase 7 Run)

Every test command was executed locally in its respective directory. No mock-only replacements or destructive operations were performed.

### Test Execution Summary Table

| Check Description | Working Directory | Command Executed | Exit Code | Tests Passed | Tests Failed | Skipped | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Backend Unit Tests** | `server/` | `npm run test:unit` | `0` | 45 | 0 | 0 | **PASSED** |
| **Backend Integration Tests** | `server/` | `npm run test:integration` | `0` | 52 | 0 | 0 | **PASSED** |
| **Frontend Component Tests** | `client/` | `npm test` | `0` | 46 | 0 | 0 | **PASSED** |
| **Frontend Production Build** | `client/` | `npm run build` | `0` | — | — | — | **PASSED (837ms)** |
| **Frontend Lint Checks** | `client/` | `npm run lint` | `0` | 43 files | 0 errors | — | **PASSED** |
| **Backend Syntax Checks** | `server/` | `npm run check` | `0` | 20 files | 0 errors | — | **PASSED** |
| **Playwright Browser E2E** | `client/` | `npm run test:e2e` | `0` | 5 | 0 | 0 | **PASSED (25.7s)** |
| **Client Audit** | `client/` | `npm audit` | `0` | — | — | — | **PASSED (0 vulns)** |
| **Server Audit** | `server/` | `npm audit` | `1` | — | — | — | **FLAGGED (Dev-only)** |

### Remaining Blockers & Prerequisites (Pre-Deployment)
1. **Live MongoDB Cluster:** Integration tests use mock query chaining and in-memory Supertest instances. Deploying to staging requires a running MongoDB server (`MONGODB_URI`).
2. **Production Secret Entropy:** `JWT_SECRET` must be set to a cryptographically strong 64-character hex string.
3. **HTTPS Encryption:** Staging/Production web host must enforce SSL/TLS encryption for all HTTP endpoints.
4. **CORS Allowlist:** `CLIENT_URL` must point to the verified production domain.

