import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidAadhaarFormat,
  maskAadhaar,
  hashIdentityNumber,
  verifyIdentityWithProvider,
} from '../../src/services/identityService.js';
import { CategoryMapping } from '../../src/models/CategoryMapping.js';
import { validateRegistrationInput } from '../../src/utils/validation.js';

describe('Identity & Specialization Matching Unit Tests', () => {
  describe('Aadhaar Validation & Masking', () => {
    it('accepts valid 12-digit Aadhaar formats with spaces and hyphens', () => {
      assert.strictEqual(isValidAadhaarFormat('987654321098'), true);
      assert.strictEqual(isValidAadhaarFormat('9876 5432 1098'), true);
      assert.strictEqual(isValidAadhaarFormat('9876-5432-1098'), true);
    });

    it('rejects invalid Aadhaar lengths, letters, or numbers starting with 0 or 1', () => {
      assert.strictEqual(isValidAadhaarFormat('12345'), false);
      assert.strictEqual(isValidAadhaarFormat('12345678901A'), false);
      assert.strictEqual(isValidAadhaarFormat('000000000000'), false);
      assert.strictEqual(isValidAadhaarFormat('111111111111'), false);
    });

    it('masks Aadhaar number to standard XXXX-XXXX-1234 format', () => {
      const masked = maskAadhaar('987654321098');
      assert.strictEqual(masked, 'XXXX-XXXX-1098');
    });

    it('produces deterministic SHA-256 HMAC hash for identity deduplication', () => {
      const hash1 = hashIdentityNumber('987654321098');
      const hash2 = hashIdentityNumber('9876 5432 1098'); // normalized
      const hash3 = hashIdentityNumber('987654321099');

      assert.strictEqual(typeof hash1, 'string');
      assert.strictEqual(hash1.length, 64);
      assert.strictEqual(hash1, hash2);
      assert.notStrictEqual(hash1, hash3);
    });

    it('returns pending verification status when authorized provider is unconfigured', async () => {
      const result = await verifyIdentityWithProvider({
        identityNumber: '987654321098',
        fullName: 'Abhishek Upadhyay',
      });

      assert.strictEqual(result.status, 'pending');
      assert.strictEqual(typeof result.providerRef, 'string');
    });
  });

  describe('Technician Registration Validation', () => {
    it('accepts registration with valid technician specialization and Aadhaar', () => {
      const payload = {
        name: 'Master Electrician',
        email: 'electrician.test@fixflow.io',
        password: 'SecurePassword123',
        role: 'technician',
        primarySpecialization: 'electrician',
        experienceYears: 7,
        serviceArea: 'North Campus',
        identityNumber: '987654321098',
      };
      const res = validateRegistrationInput(payload);
      assert.strictEqual(res.isValid, true);
    });

    it('rejects technician registration if primary specialization is missing or invalid', () => {
      const payload = {
        name: 'Master Electrician',
        email: 'electrician.test@fixflow.io',
        password: 'SecurePassword123',
        role: 'technician',
        primarySpecialization: 'invalid_trade_spec',
      };
      const res = validateRegistrationInput(payload);
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.some((e) => /primary specialization/i.test(e.issue)));
    });

    it('rejects registration if invalid Aadhaar is provided', () => {
      const payload = {
        name: 'Master Electrician',
        email: 'electrician.test@fixflow.io',
        password: 'SecurePassword123',
        role: 'technician',
        primarySpecialization: 'electrician',
        identityNumber: '12345',
      };
      const res = validateRegistrationInput(payload);
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.some((e) => /12-digit/i.test(e.issue)));
    });
  });

  describe('Category-to-Specialization Mapping', () => {
    it('correctly maps electrical incidents to electrician specialization', async () => {
      const spec = await CategoryMapping.findByCategory('electrical');
      assert.strictEqual(spec.primarySpecialization, 'electrician');
    });

    it('correctly maps plumbing incidents to plumber specialization', async () => {
      const spec = await CategoryMapping.findByCategory('plumbing');
      assert.strictEqual(spec.primarySpecialization, 'plumber');
    });

    it('correctly maps hvac incidents to hvac specialization', async () => {
      const spec = await CategoryMapping.findByCategory('hvac');
      assert.strictEqual(spec.primarySpecialization, 'hvac');
    });

    it('correctly maps carpentry incidents to carpenter specialization', async () => {
      const spec = await CategoryMapping.findByCategory('carpentry');
      assert.strictEqual(spec.primarySpecialization, 'carpenter');
    });

    it('defaults unknown categories to general specialization', async () => {
      const spec = await CategoryMapping.findByCategory('unknown_custom_issue');
      assert.strictEqual(spec.primarySpecialization, 'general');
    });
  });
});
