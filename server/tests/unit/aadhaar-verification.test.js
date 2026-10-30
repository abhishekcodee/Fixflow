import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidAadhaarFormat,
  maskAadhaar,
  hashIdentityNumber,
  normalizeAadhaar,
} from '../../src/services/identityService.js';
import DocumentStorageService from '../../src/services/documentStorageService.js';

describe('Aadhaar Identity Verification Unit Tests', () => {
  describe('Aadhaar Number Validation & Masking', () => {
    it('accepts valid 12-digit Aadhaar formats starting with 2-9', () => {
      assert.strictEqual(isValidAadhaarFormat('987654321098'), true);
      assert.strictEqual(isValidAadhaarFormat('9876 5432 1098'), true);
      assert.strictEqual(isValidAadhaarFormat('9876-5432-1098'), true);
    });

    it('rejects numbers starting with 0 or 1 per UIDAI standard', () => {
      assert.strictEqual(isValidAadhaarFormat('012345678901'), false);
      assert.strictEqual(isValidAadhaarFormat('123456789012'), false);
    });

    it('rejects Aadhaar numbers with letters or incorrect lengths', () => {
      assert.strictEqual(isValidAadhaarFormat('98765432109'), false); // 11 digits
      assert.strictEqual(isValidAadhaarFormat('9876543210987'), false); // 13 digits
      assert.strictEqual(isValidAadhaarFormat('98765432109A'), false); // letter
    });

    it('masks Aadhaar number strictly revealing only the last 4 digits', () => {
      const masked = maskAadhaar('9876 5432 1098');
      assert.strictEqual(masked, 'XXXX-XXXX-1098');
      assert.strictEqual(masked.length, 14);
      assert.strictEqual(masked.startsWith('XXXX-XXXX-'), true);
    });

    it('produces distinct deterministic HMAC SHA-256 hashes for deduplication', () => {
      const hash1 = hashIdentityNumber('987654321098');
      const hash2 = hashIdentityNumber('9876-5432-1098');
      const hash3 = hashIdentityNumber('987654321099');

      assert.strictEqual(hash1, hash2);
      assert.notStrictEqual(hash1, hash3);
      assert.strictEqual(hash1.length, 64);
    });
  });

  describe('Document Storage Vault Security', () => {
    it('encrypts document buffer at rest and successfully decrypts upon retrieval', async () => {
      const sampleBuffer = Buffer.from('FixFlow Sample Aadhaar Card Image Bytes 2026');
      const result = await DocumentStorageService.storeDocument({
        buffer: sampleBuffer,
        originalName: 'front_card.jpg',
        mimeType: 'image/jpeg',
        userId: 'test_user_001',
        side: 'front',
      });

      assert.ok(result.storageKey);
      assert.strictEqual(result.originalName, 'front_card.jpg');
      assert.strictEqual(result.mimeType, 'image/jpeg');

      // Retrieve and decrypt
      const retrieved = await DocumentStorageService.retrieveDocument(result.storageKey);
      assert.strictEqual(retrieved.buffer.toString(), sampleBuffer.toString());
      assert.strictEqual(retrieved.mimeType, 'image/jpeg');

      // Cleanup
      await DocumentStorageService.deleteDocument(result.storageKey);
    });

    it('rejects unsupported file MIME types (e.g. application/pdf, text/plain)', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 sample document');
      await assert.rejects(
        DocumentStorageService.storeDocument({
          buffer: pdfBuffer,
          originalName: 'document.pdf',
          mimeType: 'application/pdf',
          userId: 'test_user_001',
          side: 'front',
        }),
        /unsupported document format/i
      );
    });

    it('rejects oversized document files exceeding 5MB limit', async () => {
      const oversized = Buffer.alloc(5.5 * 1024 * 1024); // 5.5MB
      await assert.rejects(
        DocumentStorageService.storeDocument({
          buffer: oversized,
          originalName: 'huge.png',
          mimeType: 'image/png',
          userId: 'test_user_001',
          side: 'back',
        }),
        /exceeds 5MB limit/i
      );
    });

    it('sanitizes document storage key against directory traversal attempts', async () => {
      await assert.rejects(
        DocumentStorageService.retrieveDocument('../../sensitive/file.txt'),
        /document not found/i
      );
    });
  });
});
