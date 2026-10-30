import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';
import AadhaarVerificationModel from '../models/AadhaarVerification.js';
import DocumentStorageService from './documentStorageService.js';
import prisma from '../config/prisma.js';

/**
 * Normalizes input identity/Aadhaar string by removing whitespace, hyphens, and non-digits.
 * @param {string} input
 * @returns {string}
 */
export const normalizeAadhaar = (input) => {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[\s-]/g, '').trim();
};

/**
 * Validates 12-digit Indian Aadhaar number format.
 * Rejects numbers not exactly 12 digits, numbers starting with 0 or 1 (UIDAI standard).
 * @param {string} input
 * @returns {boolean}
 */
export const isValidAadhaarFormat = (input) => {
  const normalized = normalizeAadhaar(input);
  if (!/^[2-9]\d{11}$/.test(normalized)) {
    return false;
  }
  return true;
};

/**
 * Generates masked Aadhaar display format (only showing last 4 digits).
 * Never exposes the first 8 digits.
 * @param {string} input
 * @returns {string} e.g. "XXXX-XXXX-9012"
 */
export const maskAadhaar = (input) => {
  const normalized = normalizeAadhaar(input);
  if (normalized.length !== 12) {
    return 'XXXX-XXXX-XXXX';
  }
  const last4 = normalized.slice(-4);
  return `XXXX-XXXX-${last4}`;
};

/**
 * Computes cryptographically secure SHA-256 hash of normalized identity number.
 * Allows unique duplicate detection without storing raw plaintext numbers in database.
 * @param {string} input
 * @returns {string} 64-character hex hash
 */
export const hashIdentityNumber = (input) => {
  const normalized = normalizeAadhaar(input);
  const salt = process.env.JWT_SECRET || 'fixflow_identity_salt_2026';
  return crypto.createHmac('sha256', salt).update(normalized).digest('hex');
};

/**
 * Checks whether an authorized external identity verification provider is configured.
 * @returns {boolean}
 */
export const isIdentityProviderConfigured = () => {
  return Boolean(
    process.env.AADHAAR_PROVIDER_API_KEY &&
    (process.env.AADHAAR_PROVIDER_URL || process.env.AADHAAR_PROVIDER_CLIENT_ID)
  );
};

/**
 * Initiates real Aadhaar verification with an authorized provider.
 * Where supported by the provider, sends an OTP to the UIDAI-linked mobile number.
 * 
 * Strict Compliance:
 * - Never sends Aadhaar OTPs via Gmail SMTP.
 * - Never generates fake local OTPs pretending to be official UIDAI OTPs.
 * - Enforces 60-second resend cooldown and max attempts.
 * 
 * @param {object} params
 * @param {string} params.userId - Authenticated User ID
 * @param {string} params.aadhaarNumber - 12-digit Aadhaar number
 * @param {boolean} params.consent - Explicit user consent
 * @returns {Promise<object>}
 */
export const initiateAadhaarOtp = async ({ userId, aadhaarNumber, consent }) => {
  if (!consent) {
    throw new AppError('Explicit consent for identity verification is required.', 400);
  }

  const normalized = normalizeAadhaar(aadhaarNumber);
  if (!isValidAadhaarFormat(normalized)) {
    throw new AppError('Invalid Aadhaar number format. Aadhaar must be a 12-digit number.', 400, 'INVALID_AADHAAR_FORMAT');
  }

  const maskedNumber = maskAadhaar(normalized);
  const identityHash = hashIdentityNumber(normalized);

  // Check duplicate Aadhaar across accounts
  const duplicate = await AadhaarVerificationModel.findDuplicateHash(identityHash, userId);
  if (duplicate) {
    throw new AppError('This Aadhaar number has already been verified on another account.', 409, 'AADHAAR_ALREADY_VERIFIED');
  }

  // Check existing session & rate limits
  const existing = await AadhaarVerificationModel.findByUserId(userId);
  if (existing) {
    if (existing.verificationStatus === 'VERIFIED') {
      return {
        status: 'VERIFIED',
        message: 'Your identity is already verified.',
        maskedNumber: existing.aadhaarNumberMasked
      };
    }

    if (existing.lastResendAt) {
      const secondsSinceLast = Math.floor((Date.now() - new Date(existing.lastResendAt).getTime()) / 1000);
      if (secondsSinceLast < 60) {
        throw new AppError(`Please wait ${60 - secondsSinceLast} seconds before requesting a new OTP.`, 429, 'OTP_RATE_LIMITED');
      }
    }

    if (existing.resendAttempts >= 5) {
      throw new AppError('Maximum OTP requests exceeded. Please contact support or try again later.', 429, 'MAX_RESEND_EXCEEDED');
    }
  }

  // Check if authorized provider is configured
  if (isIdentityProviderConfigured()) {
    try {
      const providerUrl = process.env.AADHAAR_PROVIDER_URL;
      const apiKey = process.env.AADHAAR_PROVIDER_API_KEY;
      const clientId = process.env.AADHAAR_PROVIDER_CLIENT_ID || '';

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${providerUrl.replace(/\/+$/, '')}/otp/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'x-client-id': clientId
        },
        body: JSON.stringify({
          aadhaar_number: normalized,
          consent: 'Y'
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        logger.warn(`Provider rejected Aadhaar OTP initiation: ${data.message || res.statusText}`);
        throw new AppError(data.message || 'Identity provider failed to send OTP to linked mobile.', 502, 'PROVIDER_ERROR');
      }

      const providerReference = data.reference_id || data.client_ref || `UID_${Date.now()}`;
      await AadhaarVerificationModel.upsertInitiation({
        userId,
        aadhaarNumberMasked: maskedNumber,
        identityHash,
        providerReference,
        consentAcceptedAt: new Date(),
        verificationStatus: 'OTP_SENT'
      });

      return {
        status: 'OTP_SENT',
        maskedNumber,
        providerReference,
        message: 'OTP has been dispatched to the mobile number registered with your Aadhaar by the authorized verification provider.'
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error(`Error communicating with Aadhaar provider: ${err.message}`);
      throw new AppError('Unable to contact Aadhaar verification provider. Please try again later.', 503, 'PROVIDER_UNAVAILABLE');
    }
  }

  // Test / Mock environment hook
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
  if (isTest && process.env.MOCK_AADHAAR_VERIFIED === 'true') {
    const providerReference = `TEST_REF_${Date.now()}`;
    await AadhaarVerificationModel.upsertInitiation({
      userId,
      aadhaarNumberMasked: maskedNumber,
      identityHash,
      providerReference,
      consentAcceptedAt: new Date(),
      verificationStatus: 'OTP_SENT'
    });
    return {
      status: 'OTP_SENT',
      maskedNumber,
      providerReference,
      message: 'OTP initiated in test mock mode.'
    };
  }

  // When no provider credentials are configured:
  // Gracefully transition to PENDING status without inventing fake OTPs or claiming verification
  logger.info(`Aadhaar verification initiated in pending state for user [ID: ${userId}] - Provider not configured.`);
  const providerReference = `PENDING_${Date.now()}`;
  await AadhaarVerificationModel.upsertInitiation({
    userId,
    aadhaarNumberMasked: maskedNumber,
    identityHash,
    providerReference,
    consentAcceptedAt: new Date(),
    verificationStatus: 'PENDING'
  });

  // Update user model state
  await prisma.user.update({
    where: { id: userId },
    data: {
      identityStatus: 'pending',
      identityType: 'aadhaar',
      identityNumberMasked: maskedNumber,
      identityHash,
      identityProviderRef: providerReference
    }
  });

  return {
    status: 'PENDING',
    maskedNumber,
    providerReference,
    message: 'Aadhaar details recorded and queued for verification. Notice: External UIDAI provider is not yet configured; administrative document review will complete verification.',
    isProviderConfigured: false
  };
};

/**
 * Validates the Aadhaar OTP with the authorized provider.
 * 
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.otp
 * @returns {Promise<object>}
 */
export const verifyAadhaarOtp = async ({ userId, otp }) => {
  if (!otp || typeof otp !== 'string' || !/^\d{4,6}$/.test(otp.trim())) {
    throw new AppError('Please enter a valid 4 to 6-digit OTP.', 400);
  }

  const record = await AadhaarVerificationModel.findByUserId(userId);
  if (!record) {
    throw new AppError('No active Aadhaar verification session found. Please enter your Aadhaar details first.', 404);
  }

  if (record.verificationStatus === 'VERIFIED') {
    return {
      status: 'VERIFIED',
      message: 'Your identity is already verified.'
    };
  }

  // Check attempt limits
  if (record.otpAttempts >= 5) {
    throw new AppError('Too many incorrect OTP attempts. Please request a new verification code.', 429, 'MAX_OTP_ATTEMPTS');
  }

  // Check expiry
  if (record.otpExpiresAt && new Date() > new Date(record.otpExpiresAt)) {
    throw new AppError('The verification code has expired. Please request a new code.', 400, 'OTP_EXPIRED');
  }

  // If provider is configured, verify with provider
  if (isIdentityProviderConfigured()) {
    try {
      const providerUrl = process.env.AADHAAR_PROVIDER_URL;
      const apiKey = process.env.AADHAAR_PROVIDER_API_KEY;
      const clientId = process.env.AADHAAR_PROVIDER_CLIENT_ID || '';

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${providerUrl.replace(/\/+$/, '')}/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'x-client-id': clientId
        },
        body: JSON.stringify({
          reference_id: record.providerReference,
          otp: otp.trim()
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data.status === 'VERIFIED' || data.verified === true)) {
        await AadhaarVerificationModel.incrementOtpAttempts(userId);
        const remaining = 5 - (record.otpAttempts + 1);
        throw new AppError(data.message || `Invalid verification code. ${remaining} attempts remaining.`, 400, 'INVALID_OTP');
      }

      // Check if documents are already uploaded
      const hasDocs = record.frontDocumentKey && record.backDocumentKey;
      const nextStatus = hasDocs ? 'VERIFIED' : 'OTP_VERIFIED';

      await AadhaarVerificationModel.updateStatus(userId, {
        status: nextStatus,
        otpVerifiedAt: new Date(),
        ...(nextStatus === 'VERIFIED' ? { verifiedAt: new Date() } : {})
      });

      if (nextStatus === 'VERIFIED') {
        await prisma.user.update({
          where: { id: userId },
          data: {
            identityStatus: 'verified',
            identityVerifiedAt: new Date()
          }
        });
      }

      return {
        status: nextStatus,
        message: nextStatus === 'VERIFIED'
          ? 'Identity verification completed successfully.'
          : 'Aadhaar OTP confirmed. Please upload front and back card images to finalize verification.'
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error(`Error verifying Aadhaar OTP with provider: ${err.message}`);
      throw new AppError('Identity provider encountered an error while verifying code. Please try again.', 502);
    }
  }

  // Test / Mock environment hook
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
  if (isTest && (process.env.MOCK_AADHAAR_VERIFIED === 'true' || otp === '123456')) {
    const hasDocs = record.frontDocumentKey && record.backDocumentKey;
    const nextStatus = hasDocs ? 'VERIFIED' : 'OTP_VERIFIED';
    await AadhaarVerificationModel.updateStatus(userId, {
      status: nextStatus,
      otpVerifiedAt: new Date(),
      ...(nextStatus === 'VERIFIED' ? { verifiedAt: new Date() } : {})
    });
    return {
      status: nextStatus,
      message: 'OTP verified in test mock mode.'
    };
  }

  // If no provider is configured, do not forge or simulate UIDAI OTP validation
  throw new AppError(
    'Aadhaar OTP verification requires an authorized UIDAI verification provider. Provider credentials are not configured in server environment.',
    503,
    'PROVIDER_NOT_CONFIGURED'
  );
};

/**
 * Uploads front and back images of Aadhaar card to private encrypted storage.
 * 
 * @param {object} params
 * @param {string} params.userId
 * @param {Express.Multer.File} params.frontFile
 * @param {Express.Multer.File} params.backFile
 * @returns {Promise<object>}
 */
export const uploadAadhaarDocuments = async ({ userId, frontFile, backFile }) => {
  if (!frontFile || !backFile) {
    throw new AppError('Both front and back images of the Aadhaar card are required.', 400);
  }

  const record = await AadhaarVerificationModel.findByUserId(userId);
  if (!record) {
    throw new AppError('Please enter your Aadhaar number before uploading documents.', 404);
  }

  // Store front document in private vault
  const frontResult = await DocumentStorageService.storeDocument({
    buffer: frontFile.buffer,
    originalName: frontFile.originalname,
    mimeType: frontFile.mimetype,
    userId,
    side: 'front'
  });

  // Store back document in private vault
  const backResult = await DocumentStorageService.storeDocument({
    buffer: backFile.buffer,
    originalName: backFile.originalname,
    mimeType: backFile.mimetype,
    userId,
    side: 'back'
  });

  // Clean up old files if they existed
  if (record.frontDocumentKey && record.frontDocumentKey !== frontResult.storageKey) {
    await DocumentStorageService.deleteDocument(record.frontDocumentKey);
  }
  if (record.backDocumentKey && record.backDocumentKey !== backResult.storageKey) {
    await DocumentStorageService.deleteDocument(record.backDocumentKey);
  }

  // Determine next verification status
  let nextStatus = 'DOCUMENTS_UPLOADED';
  if (record.verificationStatus === 'OTP_VERIFIED' || record.otpVerifiedAt) {
    nextStatus = 'PENDING_REVIEW';
  } else if (record.verificationStatus === 'PENDING') {
    nextStatus = 'PENDING_REVIEW';
  }

  const updated = await AadhaarVerificationModel.updateDocuments({
    userId,
    frontKey: frontResult.storageKey,
    backKey: backResult.storageKey,
    frontOriginalName: frontResult.originalName,
    backOriginalName: backResult.originalName,
    frontMime: frontResult.mimeType,
    backMime: backResult.mimeType,
    frontSize: frontResult.size,
    backSize: backResult.size,
    verificationStatus: nextStatus
  });

  // Keep User.identityStatus in sync
  await prisma.user.update({
    where: { id: userId },
    data: {
      identityStatus: 'pending'
    }
  });

  return {
    status: updated.verificationStatus,
    maskedNumber: updated.aadhaarNumberMasked,
    documentsUploadedAt: updated.documentsUploadedAt,
    message: 'Front and back Aadhaar documents uploaded successfully and encrypted in secure vault.'
  };
};

/**
 * Administrative review action to approve or reject verification.
 * 
 * @param {object} params
 * @param {string} params.verificationId
 * @param {string} params.adminId
 * @param {'approve' | 'reject'} params.decision
 * @param {string} [params.rejectionReason]
 * @returns {Promise<object>}
 */
export const reviewAadhaarVerification = async ({ verificationId, adminId, decision, rejectionReason }) => {
  const verification = await AadhaarVerificationModel.findById(verificationId);
  if (!verification) {
    throw new AppError('Verification record not found.', 404);
  }

  if (decision === 'approve') {
    const updated = await prisma.aadhaarVerification.update({
      where: { id: verificationId },
      data: {
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
        reviewedById: adminId,
        rejectionReason: null
      }
    });

    await prisma.user.update({
      where: { id: verification.userId },
      data: {
        identityStatus: 'verified',
        identityVerifiedAt: new Date(),
        identityNumberMasked: verification.aadhaarNumberMasked
      }
    });

    logger.info(`Administrator [ID: ${adminId}] approved Aadhaar verification for user [ID: ${verification.userId}]`);
    return {
      success: true,
      status: 'VERIFIED',
      verification: updated,
      message: 'Identity verification approved successfully.'
    };
  }

  if (decision === 'reject') {
    if (!rejectionReason || !rejectionReason.trim()) {
      throw new AppError('Please provide a reason for rejecting identity documents.', 400);
    }

    const updated = await prisma.aadhaarVerification.update({
      where: { id: verificationId },
      data: {
        verificationStatus: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: rejectionReason.trim(),
        reviewedById: adminId
      }
    });

    await prisma.user.update({
      where: { id: verification.userId },
      data: {
        identityStatus: 'rejected'
      }
    });

    logger.info(`Administrator [ID: ${adminId}] rejected Aadhaar verification for user [ID: ${verification.userId}]`);
    return {
      success: true,
      status: 'REJECTED',
      verification: updated,
      message: 'Identity verification marked as rejected.'
    };
  }

  throw new AppError('Invalid review decision. Supported decisions: approve, reject.', 400);
};

/**
 * Gets full verification status for a user.
 * @param {string} userId
 */
export const getAadhaarVerificationStatus = async (userId) => {
  const record = await AadhaarVerificationModel.findByUserId(userId);
  if (!record) {
    return {
      status: 'NOT_STARTED',
      maskedNumber: null,
      hasFrontDocument: false,
      hasBackDocument: false
    };
  }

  return {
    status: record.verificationStatus,
    maskedNumber: record.aadhaarNumberMasked,
    hasFrontDocument: Boolean(record.frontDocumentKey),
    hasBackDocument: Boolean(record.backDocumentKey),
    frontOriginalName: record.frontDocumentOriginalName,
    backOriginalName: record.backDocumentOriginalName,
    documentsUploadedAt: record.documentsUploadedAt,
    otpVerifiedAt: record.otpVerifiedAt,
    verifiedAt: record.verifiedAt,
    rejectedAt: record.rejectedAt,
    rejectionReason: record.rejectionReason,
    providerReference: record.providerReference,
    isProviderConfigured: isIdentityProviderConfigured()
  };
};

/**
 * Legacy provider interface function preserved for backward compatibility.
 */
export const verifyIdentityWithProvider = async ({ aadhaarNumber, identityNumber, name, fullName, userId }) => {
  const targetAadhaar = aadhaarNumber || identityNumber;
  if (!isValidAadhaarFormat(targetAadhaar)) {
    throw new AppError(
      'Invalid Aadhaar number format. Aadhaar must be a 12-digit number.',
      400,
      'INVALID_AADHAAR_FORMAT'
    );
  }

  const maskedNumber = maskAadhaar(targetAadhaar);
  const identityHash = hashIdentityNumber(targetAadhaar);

  if (isIdentityProviderConfigured()) {
    try {
      const providerUrl = process.env.AADHAAR_PROVIDER_URL;
      const apiKey = process.env.AADHAAR_PROVIDER_API_KEY;
      const clientId = process.env.AADHAAR_PROVIDER_CLIENT_ID || '';

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(providerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'x-client-id': clientId
        },
        body: JSON.stringify({
          identity_type: 'aadhaar',
          identity_hash: identityHash,
          name_to_match: name || fullName
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'VERIFIED' || data.verified === true) {
          logger.info(`Identity verification confirmed by provider for user [ID: ${userId || 'pending'}]`);
          return {
            status: 'verified',
            maskedNumber,
            identityHash,
            providerRef: data.reference_id || `AUTH_UID_${Date.now()}`,
            verifiedAt: new Date(),
            message: 'Identity successfully verified by authorized provider.'
          };
        }
      }

      logger.warn(`Identity verification rejected or inconclusive by provider for user [ID: ${userId || 'pending'}]`);
      return {
        status: 'pending',
        maskedNumber,
        identityHash,
        providerRef: `REV_${Date.now()}`,
        verifiedAt: null,
        message: 'Identity verification pending administrative review.'
      };
    } catch (err) {
      logger.error(`Error communicating with identity verification provider: ${err.message}`);
      return {
        status: 'pending',
        maskedNumber,
        identityHash,
        providerRef: `ERR_${Date.now()}`,
        verifiedAt: null,
        message: 'Identity verification pending manual review due to provider timeout.'
      };
    }
  }

  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
  if (isTest && process.env.MOCK_AADHAAR_VERIFIED === 'true') {
    return {
      status: 'verified',
      maskedNumber,
      identityHash,
      providerRef: `MOCK_TEST_VERIFIED_${Date.now()}`,
      verifiedAt: new Date(),
      message: 'Identity verified via test suite mock.'
    };
  }

  logger.info(`Identity verification logged as pending for user [Masked: ${maskedNumber}] - No provider credentials configured.`);
  return {
    status: 'pending',
    maskedNumber,
    identityHash,
    providerRef: `PENDING_REVIEW_${Date.now()}`,
    verifiedAt: null,
    message: 'Identity verification request recorded and pending verification. Authorized provider not configured.'
  };
};

export default {
  normalizeAadhaar,
  isValidAadhaarFormat,
  maskAadhaar,
  hashIdentityNumber,
  isIdentityProviderConfigured,
  initiateAadhaarOtp,
  verifyAadhaarOtp,
  uploadAadhaarDocuments,
  reviewAadhaarVerification,
  getAadhaarVerificationStatus,
  verifyIdentityWithProvider
};
