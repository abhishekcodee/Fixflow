import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/token.js';
import { User } from '../models/User.js';

/**
 * Authentication Middleware:
 * Validates the JWT Bearer token and attaches the authenticated user to req.user.
 */
export const authenticate = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return next(
        new AppError('Authentication required. Please provide a valid Bearer token.', 401, 'UNAUTHORIZED')
      );
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Your session has expired. Please log in again.', 401, 'TOKEN_EXPIRED'));
      }
      return next(new AppError('Invalid authentication token.', 401, 'INVALID_TOKEN'));
    }

    // Verify user still exists in database and is active
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401, 'USER_NOT_FOUND')
      );
    }

    if (!user.isActive) {
      return next(
        new AppError('This user account has been deactivated. Please contact support.', 403, 'ACCOUNT_DEACTIVATED')
      );
    }

    // Attach safe user identity to request object
    req.user = user.toSafeObject();
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Role-Based Access Control (RBAC) Authorization Middleware:
 * Restricts access to specific user roles. Authentication alone never grants access to privileged endpoints.
 * @param  {...string} allowedRoles - e.g., 'admin', 'technician'
 */
export const authorize = (...allowedRoles) => {
  const normalizedRoles = allowedRoles.map((r) => r.toLowerCase());

  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError('Authentication required before authorization check.', 401, 'UNAUTHORIZED')
      );
    }

    if (!normalizedRoles.includes(req.user.role.toLowerCase())) {
      return next(
        new AppError(
          `Forbidden: role "${req.user.role}" does not have permission to access this resource. Required: [${normalizedRoles.join(', ')}].`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
};

export default {
  authenticate,
  authorize
};
