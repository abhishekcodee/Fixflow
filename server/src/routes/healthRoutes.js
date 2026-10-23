import express from 'express';
import { env } from '../config/env.js';
import { getDatabaseStatus } from '../config/database.js';

const router = express.Router();

/**
 * @route   GET /api/v1/health
 * @desc    API and Database Health Status Check
 * @access  Public
 */
router.get('/', (req, res) => {
  const dbStatus = getDatabaseStatus();

  const healthData = {
    status: dbStatus.isConnected ? 'healthy' : 'degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    services: {
      api: {
        status: 'online',
        version: '0.1.0',
        name: 'FixFlow API Server'
      },
      database: {
        status: dbStatus.isConnected ? 'connected' : 'disconnected',
        state: dbStatus.state,
        host: dbStatus.host,
        name: dbStatus.name,
        verified: dbStatus.isConnected
      }
    }
  };

  return res.status(200).json({
    success: true,
    data: healthData
  });
});

export default router;
