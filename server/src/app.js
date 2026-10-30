import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import technicianRoutes from './routes/technicianRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// 1. HTTP Security Headers
app.use(helmet());

// 2. Cross-Origin Resource Sharing (CORS) Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Support comma-separated origins in CLIENT_URL
      const allowedOrigins = (env.CLIENT_URL || '')
        .split(',')
        .map((o) => o.trim().replace(/\/+$/, ''))
        .filter(Boolean);

      const normalizedOrigin = origin.replace(/\/+$/, '');

      // Allow in development, matching CLIENT_URL, or any *.vercel.app / *.onrender.com deployment
      const isAllowed =
        env.NODE_ENV === 'development' ||
        allowedOrigins.includes(normalizedOrigin) ||
        /^https:\/\/([a-zA-Z0-9-_]+)\.vercel\.app$/.test(normalizedOrigin) ||
        /^https:\/\/([a-zA-Z0-9-_]+)\.onrender\.com$/.test(normalizedOrigin);

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// 3. Request Body Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. API Welcome / Base Route
app.get('/', (req, res, next) => {
  // If static client dist exists, let static handler serve the SPA root
  const clientDistPath = path.resolve('dist');
  if (fs.existsSync(clientDistPath) && fs.existsSync(path.join(clientDistPath, 'index.html'))) {
    return next();
  }

  res.status(200).json({
    success: true,
    message: 'Welcome to FixFlow API Server',
    version: '0.1.0',
    documentation: '/docs',
    endpoints: {
      health: '/api/v1/health',
      auth: '/api/v1/auth',
      complaints: '/api/v1/complaints'
    }
  });
});

// 5. Mount API Routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/complaints', complaintRoutes);
app.use('/api/v1/technicians', technicianRoutes);
app.use('/api/v1/admin', adminRoutes);

// 6. Serve static client bundle in production if built dist directory exists
const clientDistPath = path.resolve('dist');
if (fs.existsSync(clientDistPath) && fs.existsSync(path.join(clientDistPath, 'index.html'))) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// 7. 404 Route Not Found Middleware (Must be registered after all active routes)
app.use(notFound);

// 8. Centralized Error-Handling Middleware (Must be the final middleware)
app.use(errorHandler);

export default app;
