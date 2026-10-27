import prisma from './prisma.js';
import { logger } from '../utils/logger.js';
import { seedInitialData } from './seed.js';

let isDbConnected = false;

/**
 * Returns current MySQL database connection health state.
 */
export const getDatabaseStatus = () => {
  return {
    isConnected: isDbConnected,
    state: isDbConnected ? 'connected' : 'disconnected',
    readyState: isDbConnected ? 1 : 0,
    host: '127.0.0.1:3306',
    name: 'fixflow',
    engine: 'MySQL (Prisma)'
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
    logger.info('MySQL connection established successfully [Database: fixflow, Host: 127.0.0.1:3306]');

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
