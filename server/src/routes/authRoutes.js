import express from 'express';
import {
  register,
  sendOtp,
  verifyOtp,
  completeRegistration,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  logout,
  deleteAccount,
  verifyIdentity,
  getTechnicians,
  getGithubConfig,
  githubLogin
} from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

/**
 * Public Authentication & Verification Routes
 */
router.post('/register', register);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/complete-registration', completeRegistration);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

/**
 * GitHub OAuth Authentication Routes
 */
router.get('/github/config', getGithubConfig);
router.post('/github', githubLogin);

/**
 * Protected Identity Route & Account Deletion
 */
router.get('/me', authenticate, getMe);
router.delete('/me', authenticate, deleteAccount);
router.post('/verify-identity', authenticate, verifyIdentity);

/**
 * Technician Listing (Admin only)
 */
router.get('/technicians', authenticate, authorize('admin'), getTechnicians);

/**
 * Role-Based Access Control Verification Routes
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
