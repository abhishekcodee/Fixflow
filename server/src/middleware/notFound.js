import { AppError } from '../utils/AppError.js';

/**
 * 404 Not Found Middleware
 * Intercepts requests to unmapped endpoints and forwards a standardized AppError.
 */
export const notFound = (req, res, next) => {
  next(
    new AppError(
      `Cannot ${req.method} ${req.originalUrl} - Route not found on this server`,
      404,
      'ROUTE_NOT_FOUND'
    )
  );
};

export default notFound;
