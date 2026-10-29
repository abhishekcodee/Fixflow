import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

/**
 * Normalizes common Mongoose errors into clean AppError instances.
 */
const handleMongooseError = (err) => {
  // Invalid MongoDB ObjectId
  if (err.name === 'CastError') {
    return new AppError(`Invalid ${err.path}: "${err.value}"`, 400, 'INVALID_PARAMETER');
  }

  // Schema Validation Failure
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      issue: e.message
    }));
    return new AppError('Validation failed on one or more fields', 400, 'VALIDATION_ERROR', details);
  }

  // Duplicate Key Error (Code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return new AppError(`A record with this ${field} already exists.`, 409, 'DUPLICATE_ENTRY');
  }

  // Mongoose Connection, Buffering Timeout, or Network Refusal Errors
  if (
    (err.name === 'MongooseError' &&
      (err.message.includes('buffering timed out') ||
        err.message.includes('bufferCommands') ||
        err.message.includes('before initial connection is complete'))) ||
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoTimeoutError' ||
    err.code === 'ECONNREFUSED' ||
    err.message?.includes('ECONNREFUSED')
  ) {
    return new AppError(
      'Database service is currently unavailable. Please ensure that MongoDB is running locally on 127.0.0.1:27017 or configure a valid MONGODB_URI in server/.env.',
      503,
      'DATABASE_UNAVAILABLE'
    );
  }

  return err;
};

/**
 * Centralized Error-Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  let error = handleMongooseError(err);

  const statusCode = error.statusCode || 500;
  const code = error.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');
  const message = error.message || 'An unexpected error occurred.';
  const details = error.details || null;

  // Log error details on server
  if (statusCode >= 500) {
    logger.error(`[500 Server Error] ${req.method} ${req.originalUrl}: ${error.stack || error.message}`);
  } else {
    logger.warn(`[${statusCode} Client Error] ${req.method} ${req.originalUrl}: ${message}`);
  }

  // Development Response: Full transparency including stack trace
  if (env.NODE_ENV === 'development') {
    return res.status(statusCode).json({
      success: false,
      error: {
        message,
        code,
        details,
        stack: error.stack
      }
    });
  }

  // Production Response: Operational AppError
  if (error.isOperational) {
    return res.status(statusCode).json({
      success: false,
      error: {
        message,
        code,
        details
      }
    });
  }

  // Database / Prisma error transparency
  if (err.name?.startsWith('Prisma') || err.code?.startsWith('P') || error.name?.startsWith('Prisma')) {
    return res.status(500).json({
      success: false,
      error: {
        message: `Database error: ${error.message || err.message}`,
        code: err.code || 'DATABASE_ERROR'
      }
    });
  }

  // Generic fallback for unhandled exceptions
  return res.status(500).json({
    success: false,
    error: {
      message: error.message || 'An unexpected internal server error occurred.',
      code: error.code || 'INTERNAL_SERVER_ERROR'
    }
  });
};

export default errorHandler;
