# 07 — Local Development Setup Guide

## 1. Prerequisites

Before installing and running FixFlow, ensure your environment meets the following specifications:

- **Node.js:** v18.x or v20.x LTS ([Download](https://nodejs.org/))
- **Package Manager:** `npm` (bundled with Node.js) or `pnpm` / `yarn`
- **Database:** MongoDB Community Server running locally on `mongodb://localhost:27017` or a cloud-hosted MongoDB Atlas URI.
- **Git:** Version 2.30+ installed.

---

## 2. Environment Variables Specification

> [!CAUTION]
> Never commit real secrets or `.env` files to source control. Use the `.env.example` templates below to create your local `.env` files.

### Server Environment: `server/.env.example`

Create a file named `.env` inside the `server/` directory:

```ini
# Server Network Settings
PORT=5000
NODE_ENV=development

# Database Connection
# For local MongoDB:
MONGODB_URI=mongodb://localhost:27017/fixflow_dev
# Or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/fixflow_dev?retryWrites=true&w=majority

# Authentication Security
JWT_SECRET=replace_this_with_a_long_random_entropy_secret_key_minimum_32_chars
JWT_EXPIRES_IN=7d

# Client CORS Whitelist
CLIENT_URL=http://localhost:5173
```

### Client Environment: `client/.env.example`

Create a file named `.env` inside the `client/` directory:

```ini
# REST API Endpoint Root
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

---

## 3. Installation Walkthrough

### Step 1: Open Terminal in Project Root
Navigate to the root directory `FixFlow/`:
```bash
cd c:/FixFlow
```

### Step 2: Install Server Dependencies & Verify Syntax
```bash
cd server
npm install
npm run check
```
- `npm run check` uses `node --check` to validate that all ES modules, imports, and syntax in `src/` are free of syntax errors.

### Step 3: Configure Environment Variables
Copy the template configuration in `server/.env.example` to `server/.env`:
```bash
# On Windows PowerShell:
Copy-Item .env.example .env

# On macOS/Linux:
cp .env.example .env
```
Adjust `PORT` and `MONGODB_URI` as required. If MongoDB is not yet running, the server will start in development mode and report a degraded status until the database is started.

### Step 4: Install Client Dependencies
```bash
cd c:/FixFlow/client
npm install
npm run build
npm test
```

---

## 4. Running the Development Servers

### Backend API Server
```bash
cd c:/FixFlow/server

# Run in development mode with automatic reload on code changes:
npm run dev

# Or run in standard production mode:
npm start
```
*Expected Startup Output:*
```
[2026-10-23T08:18:17.991Z] [INFO] Starting FixFlow API Server in [development] mode...
[2026-10-23T08:18:17.994Z] [INFO] Attempting to connect to MongoDB at: mongodb://localhost:27017/fixflow_dev
[2026-10-23T08:18:23.086Z] [INFO] FixFlow API Server listening on port 5000
[2026-10-23T08:18:23.086Z] [INFO] Health check available at: http://localhost:5000/api/v1/health
```

### Frontend Application (Vite Dev Server)
```bash
cd c:/FixFlow/client

# Start Vite local development server on http://localhost:5173:
npm run dev

# Run automated component & route tests:
npm test

# Build optimized production bundle:
npm run build
```

---

## 5. Seed Initial Development Data (Planned for Phase 3)

Once database models and seed scripts are implemented:
```bash
cd server
npm run db:seed
```

---

## 6. Verification Checklist

1. **Verify Backend Health Endpoint:**
   Send a GET request to `http://localhost:5000/api/v1/health`:
   ```bash
   curl http://localhost:5000/api/v1/health
   # Or in PowerShell:
   Invoke-RestMethod -Uri "http://localhost:5000/api/v1/health" | ConvertTo-Json -Depth 5
   ```
   *Expected Response (When Database is Offline):*
   ```json
   {
     "success": true,
     "data": {
       "status": "degraded",
       "uptimeSeconds": 12,
       "timestamp": "2026-10-23T08:18:36.328Z",
       "environment": "development",
       "services": {
         "api": {
           "status": "online",
           "version": "0.1.0",
           "name": "FixFlow API Server"
         },
         "database": {
           "status": "disconnected",
           "state": "disconnected",
           "host": null,
           "name": null,
           "verified": false
         }
       }
     }
   }
   ```
   *Expected Response (When Database is Online):*
   `status` reports `"healthy"` and `database.status` reports `"connected"`.

2. **Verify 404 Route Not Found Handling:**
   Send a GET request to `http://localhost:5000/api/v1/undefined-route`:
   Expect HTTP 404 with standardized error envelope:
   ```json
   {
     "success": false,
     "error": {
       "message": "Cannot GET /api/v1/undefined-route - Route not found on this server",
       "code": "ROUTE_NOT_FOUND"
     }
   }
   ```
