/**
 * Custom Operational Application Error
 * Distinguishes anticipated operational errors (e.g. 404, 400 validation)
 * from unexpected programming bugs (e.g. unhandled exceptions).
 */
export class AppError extends Error {
  /**
   * @param {string} message - Descriptive error message
   * @param {number} statusCode - HTTP status code (e.g., 400, 404, 500)
   * @param {string} [code] - Machine-readable error code (e.g., 'RESOURCE_NOT_FOUND')
   * @param {Array|Object} [details] - Optional granular validation details
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
