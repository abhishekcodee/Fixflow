import express from 'express';
import { register, login, getMe, logout, getTechnicians } from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

/**
 * Public Authentication Routes
 */
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

/**
 * Protected Identity Route
 */
router.get('/me', authenticate, getMe);

/**
 * Technician Listing (Admin only)
 */
router.get('/technicians', authenticate, authorize('admin'), getTechnicians);

/**
 * Role-Based Access Control Verification Routes
 * Demonstrates strict role enforcement: authentication alone is insufficient.
 */
router.get('/admin-check', authenticate, authorize('admin'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin authorization verified.',
    data: { role: req.user.role }
  });
});

router.get('/technician-check', authenticate, authorize('technician', 'admin'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Technician authorization verified.',
    data: { role: req.user.role }
  });
});

export default router;
