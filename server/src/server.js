import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';

let server;

/**
 * Bootstraps the FixFlow API server and database connection.
 */
const startServer = async () => {
  logger.info(`Starting FixFlow API Server in [${env.NODE_ENV}] mode...`);

  // Attempt database connection
  await connectDatabase();

  // Start HTTP Listener
  server = app.listen(env.PORT, () => {
    logger.info(`FixFlow API Server listening on port ${env.PORT}`);
    logger.info(`Health check available at: http://localhost:${env.PORT}/api/v1/health`);
  });
};

/**
 * Handles graceful shutdown by stopping HTTP listener and closing DB connections.
 */
const handleGracefulShutdown = async (signal) => {
  logger.warn(`Received ${signal}. Commencing graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed successfully.');
      await disconnectDatabase();
      process.exit(0);
    });

    // Force exit if shutdown hangs over 10 seconds
    setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Listen for process termination signals
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

// Catch unhandled Promise rejections and uncaught exceptions
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection detected:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception thrown:', err);
  process.exit(1);
});

startServer();
