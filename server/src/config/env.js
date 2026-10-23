import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the server root directory (one level up from src/config)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const parsePort = (portStr, defaultPort = 5000) => {
  if (!portStr) return defaultPort;
  const parsed = parseInt(portStr, 10);
  if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid PORT environment variable: "${portStr}". Must be an integer between 1 and 65535.`);
  }
  return parsed;
};

const validateNodeEnv = (envStr) => {
  const allowed = ['development', 'production', 'test'];
  const value = envStr || 'development';
  if (!allowed.includes(value)) {
    throw new Error(`Invalid NODE_ENV: "${value}". Must be one of: ${allowed.join(', ')}.`);
  }
  return value;
};

const resolveMongoUri = (uriStr, nodeEnv) => {
  if (nodeEnv === 'production' && !uriStr) {
    throw new Error('MONGODB_URI environment variable is required in production mode.');
  }
  return uriStr || 'mongodb://127.0.0.1:27017/fixflow_dev';
};

const validateJwtSecret = (secret, nodeEnv) => {
  if (nodeEnv === 'production') {
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET environment variable is required in production and must be at least 32 characters long.');
    }
    return secret;
  }
  return secret || 'fixflow_development_jwt_secret_key_minimum_32_characters_for_security';
};

const validateJwtExpiresIn = (expiresIn) => {
  return expiresIn || '7d';
};

export const env = Object.freeze({
  PORT: parsePort(process.env.PORT, 5000),
  NODE_ENV: validateNodeEnv(process.env.NODE_ENV),
  MONGODB_URI: resolveMongoUri(process.env.MONGODB_URI, process.env.NODE_ENV || 'development'),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  JWT_SECRET: validateJwtSecret(process.env.JWT_SECRET, process.env.NODE_ENV || 'development'),
  JWT_EXPIRES_IN: validateJwtExpiresIn(process.env.JWT_EXPIRES_IN)
});

export default env;
