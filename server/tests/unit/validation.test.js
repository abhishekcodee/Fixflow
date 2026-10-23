import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePasswordPolicy,
  validateRegistrationInput,
  validateLoginInput
} from '../../src/utils/validation.js';

describe('Validation Utilities Unit Tests', () => {
  describe('validatePasswordPolicy', () => {
    it('should accept valid passwords meeting length and complexity rules', () => {
      const result = validatePasswordPolicy('SecurePass123');
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.error, undefined);
    });

    it('should reject passwords shorter than 8 characters', () => {
      const result = validatePasswordPolicy('Pass1');
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /at least 8 characters/);
    });

    it('should reject passwords lacking numbers', () => {
      const result = validatePasswordPolicy('OnlyLettersHere');
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /at least one letter and one number/);
    });

    it('should reject passwords lacking letters', () => {
      const result = validatePasswordPolicy('1234567890');
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /at least one letter and one number/);
    });

    it('should reject passwords exceeding 128 characters', () => {
      const longPassword = 'A1' + 'a'.repeat(130);
      const result = validatePasswordPolicy(longPassword);
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /not exceed 128 characters/);
    });
  });

  describe('validateRegistrationInput', () => {
    it('should accept complete, well-formed registration payloads', () => {
      const payload = {
        name: 'Jordan Lee',
        email: 'jordan.lee@example.com',
        password: 'Password123'
      };
      const result = validateRegistrationInput(payload);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should reject invalid names (too short or missing)', () => {
      const payload = {
        name: 'J',
        email: 'jordan@example.com',
        password: 'Password123'
      };
      const result = validateRegistrationInput(payload);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some((e) => e.field === 'name'));
    });

    it('should reject malformed email addresses', () => {
      const payload = {
        name: 'Jordan Lee',
        email: 'not-an-email',
        password: 'Password123'
      };
      const result = validateRegistrationInput(payload);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some((e) => e.field === 'email'));
    });

    it('should report multiple simultaneous validation failures', () => {
      const payload = {
        name: '',
        email: 'invalid',
        password: 'short'
      };
      const result = validateRegistrationInput(payload);
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.length, 3);
    });
  });

  describe('validateLoginInput', () => {
    it('should accept valid email and password', () => {
      const result = validateLoginInput({
        email: 'user@example.com',
        password: 'Password123'
      });
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should reject missing email or missing password', () => {
      const missingEmail = validateLoginInput({ email: '', password: 'Password123' });
      assert.strictEqual(missingEmail.isValid, false);

      const missingPassword = validateLoginInput({ email: 'user@example.com', password: '' });
      assert.strictEqual(missingPassword.isValid, false);
    });
  });
});
