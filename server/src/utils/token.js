import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const getJwtSecret = () => {
  if (env.NODE_ENV === 'production' && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
    throw new Error('JWT_SECRET environment variable is required in production and must be at least 32 characters long.');
  }
  return env.JWT_SECRET || 'fixflow_development_jwt_secret_key_minimum_32_characters_for_security';
};

/**
 * Signs a JSON Web Token containing the user's minimal claims.
 * @param {object} user - User document or safe object
 * @returns {string} Signed JWT
 */
export const signToken = (user) => {
  if (!user) {
    throw new TypeError('Cannot sign JWT: user object is required.');
  }

  const rawId = user.id !== undefined && user.id !== null ? user.id : user._id;
  if (!rawId) {
    throw new TypeError('Cannot sign JWT: user.id or user._id is missing.');
  }

  if (!user.role) {
    throw new TypeError('Cannot sign JWT: user.role is missing.');
  }

  const id = typeof rawId === 'object' && typeof rawId.toString === 'function'
    ? rawId.toString()
    : String(rawId);

  const secret = getJwtSecret();
  const payload = {
    id,
    role: user.role
  };

  return jwt.sign(payload, secret, {
    expiresIn: env.JWT_EXPIRES_IN
  });
};

/**
 * Verifies a JSON Web Token.
 * @param {string} token - Raw JWT string
 * @returns {object} Decoded payload
 */
export const verifyToken = (token) => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
};

/**
 * Generates a cryptographically secure random numeric OTP.
 * @param {number} [digits=6]
 * @returns {string} 6-digit string
 */
export const generateNumericOtp = (digits = 6) => {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits;
  return crypto.randomInt(min, max).toString();
};

export default {
  signToken,
  verifyToken,
  generateNumericOtp
};
