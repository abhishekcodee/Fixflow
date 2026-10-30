import multer from 'multer';
import {
  initiateAadhaarOtp,
  verifyAadhaarOtp,
  uploadAadhaarDocuments,
  reviewAadhaarVerification,
  getAadhaarVerificationStatus
} from '../services/identityService.js';
import AadhaarVerificationModel from '../models/AadhaarVerification.js';
import DocumentStorageService from '../services/documentStorageService.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

// Multer memory storage configuration for document upload (max 5MB per file)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new AppError('Only JPEG, PNG, and WebP images are permitted for Aadhaar upload.', 400), false);
    }
  }
});

export const documentUploadMiddleware = upload.fields([
  { name: 'frontImage', maxCount: 1 },
  { name: 'backImage', maxCount: 1 }
]);

/**
 * Initiates Aadhaar identity verification and OTP generation.
 * POST /api/v1/identity/aadhaar/initiate
 */
export const initiateVerification = async (req, res, next) => {
  try {
    const { aadhaarNumber, consent } = req.body;
    if (!aadhaarNumber) {
      return res.status(400).json({
        success: false,
        error: { message: 'Aadhaar number is required.' }
      });
    }

    const result = await initiateAadhaarOtp({
      userId: req.user.id,
      aadhaarNumber,
      consent: Boolean(consent)
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validates Aadhaar OTP.
 * POST /api/v1/identity/aadhaar/verify-otp
 */
export const verifyOtp = async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({
        success: false,
        error: { message: 'Verification OTP is required.' }
      });
    }

    const result = await verifyAadhaarOtp({
      userId: req.user.id,
      otp: String(otp).trim()
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Uploads front and back Aadhaar images.
 * POST /api/v1/identity/aadhaar/upload-documents
 */
export const uploadDocuments = async (req, res, next) => {
  try {
    const frontFile = req.files?.frontImage?.[0];
    const backFile = req.files?.backImage?.[0];

    if (!frontFile || !backFile) {
      return res.status(400).json({
        success: false,
        error: { message: 'Both front and back images of your Aadhaar card are required.' }
      });
    }

    const result = await uploadAadhaarDocuments({
      userId: req.user.id,
      frontFile,
      backFile
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves the current verification status for authenticated user.
 * GET /api/v1/identity/aadhaar/status
 */
export const getStatus = async (req, res, next) => {
  try {
    const status = await getAadhaarVerificationStatus(req.user.id);
    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Streams document image for authenticated owner.
 * GET /api/v1/identity/aadhaar/documents/:side
 */
export const getDocument = async (req, res, next) => {
  try {
    const { side } = req.params;
    if (!['front', 'back'].includes(side)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid document side.' } });
    }

    const record = await AadhaarVerificationModel.findByUserId(req.user.id);
    if (!record) {
      return res.status(404).json({ success: false, error: { message: 'Document not found.' } });
    }

    const storageKey = side === 'front' ? record.frontDocumentKey : record.backDocumentKey;
    if (!storageKey) {
      return res.status(404).json({ success: false, error: { message: `No ${side} document uploaded.` } });
    }

    const { buffer, mimeType } = await DocumentStorageService.retrieveDocument(storageKey);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: List identity verification requests.
 * GET /api/v1/admin/identity-verifications
 */
export const getAdminVerifications = async (req, res, next) => {
  try {
    const { status, limit, page } = req.query;
    const result = await AadhaarVerificationModel.listAdminVerifications({
      status,
      limit,
      page
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Stream document image for administrator review.
 * GET /api/v1/admin/identity-verifications/:id/documents/:side
 */
export const getAdminDocument = async (req, res, next) => {
  try {
    const { id, side } = req.params;
    if (!['front', 'back'].includes(side)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid document side.' } });
    }

    const record = await AadhaarVerificationModel.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, error: { message: 'Verification record not found.' } });
    }

    const storageKey = side === 'front' ? record.frontDocumentKey : record.backDocumentKey;
    if (!storageKey) {
      return res.status(404).json({ success: false, error: { message: `No ${side} document found.` } });
    }

    logger.info(`Admin [ID: ${req.user.id}] accessed Aadhaar document [Verification: ${id}, Side: ${side}]`);
    const { buffer, mimeType } = await DocumentStorageService.retrieveDocument(storageKey);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Approve or Reject identity verification review.
 * PATCH /api/v1/admin/identity-verifications/:id/review
 */
export const reviewVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision, rejectionReason } = req.body;

    const result = await reviewAadhaarVerification({
      verificationId: id,
      adminId: req.user.id,
      decision,
      rejectionReason
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export default {
  documentUploadMiddleware,
  initiateVerification,
  verifyOtp,
  uploadDocuments,
  getStatus,
  getDocument,
  getAdminVerifications,
  getAdminDocument,
  reviewVerification
};
