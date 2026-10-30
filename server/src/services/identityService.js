import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

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
  // Verhoeff checksum algorithm can be used for deep validation
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
 * Dispatches identity verification to an authorized identity provider (or queues as pending).
 * 
 * Strict Compliance Rules:
 * 1. Never stores raw Aadhaar in plaintext.
 * 2. Never logs raw Aadhaar.
 * 3. Never claims verified unless provider explicitly confirms.
 * 4. Falls back to clear "pending" state when provider is unconfigured.
 * 
 * @param {object} params
 * @param {string} params.aadhaarNumber - 12-digit number
 * @param {string} params.name - Candidate name for match
 * @param {string} [params.userId] - FixFlow User ID
 * @returns {Promise<{
 *   status: 'verified' | 'pending' | 'rejected',
 *   maskedNumber: string,
 *   identityHash: string,
 *   providerRef: string,
 *   verifiedAt: Date | null,
 *   message: string
 * }>}
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

  // 1. Check if authorized identity verification provider credentials are set
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
          name_to_match: name
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

  // 2. Test / Mock environment hook (only enabled during automated unit/integration tests or with explicit test bypass)
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

  // 3. Default Production Behavior when no provider is configured:
  // State is set to 'pending' with clear explanation.
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
  verifyIdentityWithProvider
};
