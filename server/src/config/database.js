import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

/**
 * Returns current MongoDB connection health state.
 */
export const getDatabaseStatus = () => {
  const readyState = mongoose.connection.readyState;
  const isConnected = readyState === 1;

  return {
    isConnected,
    state: READY_STATES[readyState] || 'unknown',
    readyState,
    host: isConnected ? mongoose.connection.host : null,
    name: isConnected ? mongoose.connection.name : null
  };
};

/**
 * Connects to MongoDB using Mongoose.
 * @returns {Promise<boolean>} resolves true if connected, false if connection could not be established
 */
export const connectDatabase = async () => {
  // Register connection lifecycle listeners
  mongoose.connection.on('connected', () => {
    logger.info(`MongoDB connection established [Database: ${mongoose.connection.name}, Host: ${mongoose.connection.host}]`);
  });

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  try {
    logger.info(`Attempting to connect to MongoDB at: ${env.MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@')}`);

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // 5-second timeout for fail-fast behavior
      connectTimeoutMS: 5000
    });

    return true;
  } catch (error) {
    logger.error(`Failed to connect to MongoDB: ${error.message}`);

    // Prevent operations from hanging for 10,000ms by disabling command buffering when connection is down
    mongoose.set('bufferCommands', false);
    mongoose.set('bufferTimeoutMS', 2000);

    if (env.NODE_ENV === 'development') {
      logger.warn(
        'MongoDB is currently unavailable. The server will run, but database-dependent features will fail.\n' +
        '  - If using local MongoDB, ensure the service is running (e.g., "net start MongoDB").\n' +
        '  - Or update MONGODB_URI in server/.env with your cloud MongoDB Atlas connection string.'
      );
    } else {
      // In production, database availability is critical
      throw error;
    }

    return false;
  }
};

/**
 * Disconnects cleanly from MongoDB (for graceful server shutdown).
 */
export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
      logger.info('MongoDB connection closed cleanly');
    } catch (err) {
      logger.error(`Error closing MongoDB connection: ${err.message}`);
    }
  }
};

export default {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus
};
