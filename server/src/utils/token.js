import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Signs a JSON Web Token containing the user's minimal claims.
 * @param {object} user - User document or safe object
 * @returns {string} Signed JWT
 */
export const signToken = (user) => {
  const payload = {
    id: user.id || user._id.toString(),
    role: user.role
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN
  });
};

/**
 * Verifies a JSON Web Token.
 * @param {string} token - Raw JWT string
 * @returns {object} Decoded payload
 */
export const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

import crypto from 'crypto';

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
