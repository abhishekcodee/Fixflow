# 10 — Troubleshooting & Debugging Guide

This reference outlines common failure modes encountered during MERN stack development and provides verified solutions.

---

## 1. MongoDB Connection Issues

### Issue: `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`
- **Root Cause:** Local MongoDB daemon (`mongod`) is not running on your machine.
- **Resolution:**
  - *Windows:* Open PowerShell as Administrator and run `net start MongoDB` or verify the MongoDB service in `services.msc`.
  - *Alternative:* If using MongoDB Atlas, check that `MONGODB_URI` in `server/.env` points to your Atlas connection string, and ensure your current IP address is added to the MongoDB Atlas Network Access IP Whitelist.

### Issue: `MongoServerError: Authentication failed`
- **Root Cause:** Incorrect database username or password in the `MONGODB_URI` connection string.
- **Resolution:** Double-check username and password in `server/.env`. If the password contains special characters (e.g. `@`, `:`, `/`), ensure they are URL-encoded.

---

## 2. CORS (Cross-Origin Resource Sharing) Errors

### Issue: `Access to XMLHttpRequest at 'http://localhost:5000/api/v1/...' from origin 'http://localhost:5173' has been blocked by CORS policy`
- **Root Cause:** The backend server does not have CORS middleware configured to recognize `http://localhost:5173` as an allowed origin.
- **Resolution:**
  - Verify `server/.env` contains `CLIENT_URL=http://localhost:5173`.
  - Ensure the Express app configures `cors({ origin: process.env.CLIENT_URL, credentials: true })`.

---

## 3. Network & Port Conflicts

### Issue: `Error: listen EADDRINUSE: address already in use :::5000`
- **Root Cause:** Another process is already running on port 5000 (often a previously hung Node process).
- **Resolution (Windows PowerShell):**
  ```powershell
  # Find the process holding port 5000
  Get-NetTCPConnection -LocalPort 5000 | Select-Object OwningProcess

  # Terminate the process by ID
  Stop-Process -Id <PID> -Force
  ```
  - Alternatively, change `PORT=5001` in `server/.env` and update `VITE_API_BASE_URL` in `client/.env`.

---

## 4. Environment Variables Not Loading

### Issue: `process.env.VARIABLE_NAME is undefined` (Backend)
- **Root Cause:** `dotenv.config()` was not called before importing modules that read environment variables.
- **Resolution:** Ensure `import 'dotenv/config';` or `dotenv.config();` is placed at the very top of the server entry file (`server.js`).

### Issue: `import.meta.env.VARIABLE_NAME is undefined` (Frontend Vite)
- **Root Cause:** Vite only exposes environment variables prefixed with `VITE_` to client-side code.
- **Resolution:** Rename the variable in `client/.env` to include the prefix (e.g., `VITE_API_BASE_URL`). Restart the Vite development server after editing `.env`.

---

## 5. Authentication & JWT Errors

### Issue: `JsonWebTokenError: jwt malformed` or `invalid signature`
- **Root Cause:** The `Authorization` header is formatted incorrectly or the server's `JWT_SECRET` changed.
- **Resolution:**
  - Ensure the client sends the header formatted as `Bearer <token>` with a single space.
  - Check that `JWT_SECRET` in `server/.env` is consistent and non-empty.

### Issue: `TokenExpiredError: jwt expired`
- **Root Cause:** The token validity window has lapsed.
- **Resolution:** Client application must catch `401 Unauthorized` responses and redirect the user to the login page to re-authenticate.

---

## 6. Single Page Application (SPA) Routing 404s

### Issue: Browser returns 404 when refreshing a deep route (e.g., `/complaints/FIX-001`) in production
- **Root Cause:** In an SPA, routes are handled client-side by React Router. When the browser requests `/complaints/FIX-001` directly from the web server, no physical file exists at that path.
- **Resolution:** Configure the web server (or static host) to redirect all unmatched requests back to `index.html` (e.g., in Express: `app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, 'dist', 'index.html')));`).

---

## 7. Dependency Vulnerabilities & `npm audit` Warnings

### Issue: `npm audit` flags high severity vulnerability in `braces` via `nodemon`
- **Root Cause:** The development dependency `nodemon` depends on `chokidar@3`, which transitively depends on `braces <=3.0.3` (GHSA-vfj7-8cjw-p6xm, stack-exhaustion regex parsing).
- **CRITICAL WARNING:** **Never run `npm audit fix --force`**.
  - npm's automated suggestion for this advisory is to downgrade `nodemon` to version `1.14.10` (released in 2018). Doing so breaks modern Node.js ES modules and causes the server startup to fail completely.
- **Safety Assessment & Resolution:**
  1. **Production is 100% clean:** Running `npm audit --omit=dev` confirms **0 vulnerabilities** across all production runtime dependencies (`express`, `mongoose`, `cors`, `helmet`, `dotenv`).
  2. **Safe Alternatives for Development:**
     - **Option 1 (Node Native Watcher):** Use Node's built-in file watcher via `node --watch src/server.js` (supported natively on Node 18.11+, 20+, 22+, 24+). This requires no third-party dev dependencies at all.
     - **Option 2 (Acceptable Dev Risk):** Keep `nodemon` for local development. Because file paths watched on your local machine are written and controlled by you (not untrusted end-users), the theoretical stack-exhaustion denial-of-service vector cannot be exploited.

