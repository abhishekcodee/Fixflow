# 09 — Production Deployment Guide

## 1. Production Architecture Options

FixFlow supports two primary production deployment paradigms:

### Option A: Decoupled Cloud Hosting (Recommended for Scalability)
- **Frontend:** Static Asset Hosting on **Vercel**, **Netlify**, or **Cloudflare Pages**.
- **Backend:** Container or Node runtime on **Render**, **Railway**, or **AWS ECS/EC2**.
- **Database:** Managed **MongoDB Atlas** cluster.

### Option B: Unified Single-Server Container
The Express server is configured to serve the compiled React bundle from `client/dist` directly as static middleware. Ideal for low-overhead single-container deployments (e.g., Docker, DigitalOcean Droplet, AWS Lightsail).

---

## 2. Production Build Procedures

### 2.1 Compiling the Frontend Application
```bash
cd client
npm run build
```
- This triggers `vite build`.
- Minified, code-split JavaScript and CSS assets are output to `client/dist/`.
- Assets include content hashes (e.g., `index-a8d29f.js`) for cache busting.

### 2.2 Preparing the Backend Server
```bash
cd server
npm prune --production
```
- Removes development-only dependencies (`devDependencies`) to reduce deployment disk footprint.
- Runs natively with: `npm start` (which executes `node src/server.js`).

---

## 3. Production Environment Variables Checklist

Ensure every variable is configured in your production hosting dashboard:

| Variable | Target Environment | Security Level | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Server | Non-sensitive | Must be set to `production` (enables caching, hides error stack traces). |
| `PORT` | Server | Non-sensitive | Assigned by cloud host (e.g., `8080` or `10000`). |
| `MONGODB_URI` | Server | **CRITICAL SECRET** | Production MongoDB Atlas URI with secure user credentials and IP whitelist. |
| `JWT_SECRET` | Server | **CRITICAL SECRET** | High-entropy string (64+ random hex characters). Never reuse development keys. |
| `JWT_EXPIRES_IN` | Server | Non-sensitive | Standard expiration window (e.g., `24h` or `7d`). |
| `CLIENT_URL` | Server | Sensitive | The exact HTTPS production domain of the frontend (e.g., `https://fixflow.example.com`). |
| `VITE_API_BASE_URL` | Client | Non-sensitive | The HTTPS endpoint of the production API (e.g., `https://api.fixflow.example.com/api/v1`). |

---

## 4. Production Security Hardening

1. **Strict CORS Whitelisting:**
   Never allow wildcard origins (`*`) in production. The backend must strictly validate the `Origin` header against `CLIENT_URL`.
2. **Reverse Proxy & TLS Termination:**
   All web traffic must be forced over HTTPS with modern TLS 1.3 ciphers.
3. **Database Network Access:**
   Configure MongoDB Atlas Network Access rules to only accept inbound connections from the IP addresses of the backend application servers.
4. **Log Redaction:**
   Ensure production loggers never record raw passwords, authorization tokens, or sensitive user personal data.
