/**
 * FixFlow Structured Console Logger
 * Provides formatted timestamps and log levels for server diagnostics.
 */

const formatTimestamp = () => new Date().toISOString();

export const logger = {
  info: (message, meta) => {
    console.log(`[${formatTimestamp()}] [INFO] ${message}`, meta ? meta : '');
  },
  warn: (message, meta) => {
    console.warn(`[${formatTimestamp()}] [WARN] ${message}`, meta ? meta : '');
  },
  error: (message, meta) => {
    console.error(`[${formatTimestamp()}] [ERROR] ${message}`, meta ? meta : '');
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${formatTimestamp()}] [DEBUG] ${message}`, meta ? meta : '');
    }
  }
};

export default logger;
