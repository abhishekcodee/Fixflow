import express from 'express';
import {
  getAdminTechnicians,
  updateTechnicianApproval,
  getCategoryMappings,
  updateCategoryMapping
} from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Category mappings list is viewable by authenticated users/admins
router.get('/category-mappings', getCategoryMappings);

// Admin-only operations
router.use(authorize('admin'));

router.get('/technicians', getAdminTechnicians);
router.patch('/technicians/:id/approval', updateTechnicianApproval);
router.put('/category-mappings/:category', updateCategoryMapping);

export default router;
