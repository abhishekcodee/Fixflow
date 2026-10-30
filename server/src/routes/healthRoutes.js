import express from 'express';
import { env } from '../config/env.js';
import { getDatabaseStatus } from '../config/database.js';
import prisma from '../config/prisma.js';

const router = express.Router();

/**
 * Builds the standard health payload.
 */
const getHealthPayload = () => {
  const dbStatus = getDatabaseStatus();

  return {
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
};

/**
 * @route   GET /api/v1/health or GET /health
 * @desc    Liveness Check: Returns 200 OK as long as the Express process is running.
 * @access  Public
 */
router.get('/', (req, res) => {
  const healthData = getHealthPayload();
  return res.status(200).json({
    success: true,
    data: healthData
  });
});

router.get('/health', (req, res) => {
  const healthData = getHealthPayload();
  return res.status(200).json({
    success: true,
    data: healthData
  });
});

/**
 * @route   GET /api/v1/health/ready or GET /ready
 * @desc    Readiness Check: Actively probes the TiDB Cloud database.
 *          Returns 200 if connected, 503 if unavailable.
 * @access  Public
 */
router.get('/ready', async (req, res) => {
  try {
    // 3-second timeout safety for readiness check
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database ping timed out')), 3000))
    ]);

    const healthData = getHealthPayload();
    return res.status(200).json({
      success: true,
      ready: true,
      data: healthData
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      ready: false,
      error: {
        message: 'Service is not ready. Database connection probe failed.',
        code: 'SERVICE_UNAVAILABLE',
        details: error.message
      }
    });
  }
});

export default router;
