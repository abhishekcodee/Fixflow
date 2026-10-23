import express from 'express';
import {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaint,
  assignTechnician,
  updateComplaintStatus,
  getComplaintHistory,
  submitFeedback
} from '../controllers/complaintController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All complaint endpoints require an authenticated user
router.use(authenticate);

/**
 * @route   POST /api/v1/complaints
 * @desc    Submit a new complaint (User, Admin)
 */
router.post('/', createComplaint);

/**
 * @route   GET /api/v1/complaints
 * @desc    List complaints scoped by caller role with bounded pagination and filters
 */
router.get('/', getComplaints);

/**
 * @route   GET /api/v1/complaints/:id
 * @desc    Retrieve single complaint (Creator, Assigned Technician, or Admin)
 */
router.get('/:id', getComplaintById);

/**
 * @route   PATCH /api/v1/complaints/:id
 * @desc    Update permitted complaint fields (Creator if submitted, or Admin)
 */
router.patch('/:id', updateComplaint);

/**
 * @route   POST /api/v1/complaints/:id/assign
 * @desc    Assign a technician to a complaint (Admin only)
 */
router.post('/:id/assign', authorize('admin'), assignTechnician);

/**
 * @route   POST /api/v1/complaints/:id/status
 * @desc    Update complaint status following validated workflow state machine
 */
router.post('/:id/status', updateComplaintStatus);

/**
 * @route   GET /api/v1/complaints/:id/history
 * @desc    Retrieve immutable activity audit history for a complaint
 */
router.get('/:id/history', getComplaintHistory);

/**
 * @route   POST /api/v1/complaints/:id/feedback
 * @desc    Submit rating and feedback for a resolved or closed complaint (Creator only)
 */
router.post('/:id/feedback', submitFeedback);

export default router;
