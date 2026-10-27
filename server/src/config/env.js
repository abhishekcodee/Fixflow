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

const resolveDatabaseUrl = (urlStr, nodeEnv) => {
  return urlStr || (nodeEnv === 'production' ? '' : 'mysql://root:@localhost:3306/fixflow');
};

const validateJwtSecret = (secret, nodeEnv) => {
  return secret || (nodeEnv === 'production' ? '' : 'fixflow_development_jwt_secret_key_minimum_32_characters_for_security');
};

const validateJwtExpiresIn = (expiresIn) => {
  return expiresIn || '7d';
};

export const env = Object.freeze({
  PORT: parsePort(process.env.PORT, 5000),
  NODE_ENV: validateNodeEnv(process.env.NODE_ENV),
  DATABASE_URL: resolveDatabaseUrl(process.env.DATABASE_URL, process.env.NODE_ENV || 'development'),
  MONGODB_URI: process.env.MONGODB_URI || '',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  JWT_SECRET: validateJwtSecret(process.env.JWT_SECRET, process.env.NODE_ENV || 'development'),
  JWT_EXPIRES_IN: validateJwtExpiresIn(process.env.JWT_EXPIRES_IN),
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_SECURE: process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : parseInt(process.env.SMTP_PORT || '465', 10) === 465,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  FROM_EMAIL: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@fixflow.com',
  FROM_NAME: process.env.FROM_NAME || 'FixFlow Facilities Care',
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || ''
});

export default env;
