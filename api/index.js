import app from '../server/src/app.js';
import { connectDatabase } from '../server/src/config/database.js';

/**
 * Vercel Serverless Function entry point.
 * Ensures the MongoDB connection is established or reused from cache before delegating to Express.
 */
export default async function handler(req, res) {
  try {
    await connectDatabase();
  } catch (dbErr) {
    console.error('Serverless database connection warning:', dbErr.message);
  }
  return app(req, res);
}
