import prisma from './prisma.js';
import { logger } from '../utils/logger.js';
import { seedInitialData } from './seed.js';

let isDbConnected = false;

/**
 * Extracts database host from DATABASE_URL for diagnostic reporting.
 * Never exposes credentials or passwords.
 */
const getDbHost = () => {
  try {
    const rawUrl = process.env.DATABASE_URL;
    if (rawUrl) {
      const parsed = new URL(rawUrl);
      return `${parsed.hostname}:${parsed.port || '3306'}`;
    }
  } catch {
    // Fallback if URL cannot be parsed
  }
  return 'TiDB Cloud MySQL';
};

/**
 * Extracts database name from DATABASE_URL.
 */
const getDbName = () => {
  try {
    const rawUrl = process.env.DATABASE_URL;
    if (rawUrl) {
      const parsed = new URL(rawUrl);
      return parsed.pathname.replace(/^\/+/, '') || 'fixflow';
    }
  } catch {
    // Fallback
  }
  return 'fixflow';
};

/**
 * Returns current MySQL database connection health state.
 */
export const getDatabaseStatus = () => {
  return {
    isConnected: isDbConnected,
    state: isDbConnected ? 'connected' : 'disconnected',
    readyState: isDbConnected ? 1 : 0,
    host: getDbHost(),
    name: getDbName(),
    engine: 'MySQL (TiDB Cloud / Prisma)'
  };
};

/**
 * Connects to MySQL using Prisma and verifies connectivity.
 * @returns {Promise<boolean>} resolves true if connected, false if connection failed
 */
export const connectDatabase = async () => {
  try {
    logger.info('Connecting to MySQL database via Prisma...');
    await prisma.$queryRaw`SELECT 1`;
    isDbConnected = true;
    logger.info(`MySQL connection established successfully [Database: ${getDbName()}, Host: ${getDbHost()}]`);

    await seedInitialData();
    return true;
  } catch (error) {
    isDbConnected = false;
    logger.error(`Failed to connect to MySQL database: ${error.message}`);
    return false;
  }
};

/**
 * Disconnects cleanly from MySQL Prisma client.
 */
export const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    isDbConnected = false;
    logger.info('MySQL connection closed cleanly');
  } catch (err) {
    logger.error(`Error disconnecting from MySQL: ${err.message}`);
  }
};

export default {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus
};
