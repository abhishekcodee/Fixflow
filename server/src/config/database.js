import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
import { seedInitialData } from './seed.js';

const READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

let mongoMemoryInstance = null;

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
    name: isConnected ? mongoose.connection.name : null,
    isInMemory: Boolean(mongoMemoryInstance)
  };
};

/**
 * Connects to MongoDB using Mongoose.
 * Falls back to an embedded in-memory MongoDB in development if local/remote MongoDB is unreachable.
 * @returns {Promise<boolean>} resolves true if connected, false if connection could not be established
 */
export const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

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
      serverSelectionTimeoutMS: 2000, // 2-second timeout for rapid failover to local fallback
      connectTimeoutMS: 2000
    });

    if (env.NODE_ENV === 'development') {
      await seedInitialData();
    }

    return true;
  } catch (error) {
    logger.warn(`Could not connect to external MongoDB at ${env.MONGODB_URI}: ${error.message}`);

    if (env.NODE_ENV === 'development') {
      try {
        logger.info('Starting embedded in-memory MongoDB instance for local development...');
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        mongoMemoryInstance = await MongoMemoryServer.create({
          instance: {
            dbName: 'fixflow_dev'
          }
        });

        const memoryUri = mongoMemoryInstance.getUri();
        logger.info(`Connecting to embedded in-memory MongoDB at: ${memoryUri}`);

        await mongoose.connect(memoryUri);
        logger.info('Embedded in-memory MongoDB connected successfully.');

        await seedInitialData();
        return true;
      } catch (memError) {
        logger.error(`Failed to launch embedded MongoDB: ${memError.message}`);
      }
    } else {
      // In production, database availability is critical
      throw error;
    }

    // Disable command buffering so requests fail fast if database couldn't start
    mongoose.set('bufferCommands', false);
    mongoose.set('bufferTimeoutMS', 2000);

    return false;
  }
};

/**
 * Disconnects cleanly from MongoDB and stops any embedded memory instance.
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

  if (mongoMemoryInstance) {
    try {
      await mongoMemoryInstance.stop();
      mongoMemoryInstance = null;
      logger.info('Embedded in-memory MongoDB stopped cleanly');
    } catch (err) {
      logger.error(`Error stopping embedded MongoDB: ${err.message}`);
    }
  }
};

export default {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus
};
