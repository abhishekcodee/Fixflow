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

export default {
  signToken,
  verifyToken
};
