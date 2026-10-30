import express from 'express';
import {
  initiateVerification,
  verifyOtp,
  uploadDocuments,
  getStatus,
  getDocument,
  documentUploadMiddleware
} from '../controllers/identityController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * All Aadhaar identity endpoints require user authentication.
 */
router.use(authenticate);

router.post('/aadhaar/initiate', initiateVerification);
router.post('/aadhaar/verify-otp', verifyOtp);
router.post('/aadhaar/upload-documents', documentUploadMiddleware, uploadDocuments);
router.get('/aadhaar/status', getStatus);
router.get('/aadhaar/documents/:side', getDocument);

export default router;
