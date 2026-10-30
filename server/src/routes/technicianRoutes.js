import express from 'express';
import {
  getTechnicianProfileMe,
  updateTechnicianProfileMe,
  toggleTechnicianAvailability,
  getMatchingTechnicians
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * Public or Authenticated Matching Query
 */
router.get('/matching', getMatchingTechnicians);

/**
 * Authenticated Technician Specific Profile & Controls
 */
router.use(authenticate);

router.get('/me', getTechnicianProfileMe);
router.patch('/me', updateTechnicianProfileMe);
router.patch('/availability', toggleTechnicianAvailability);

export default router;
