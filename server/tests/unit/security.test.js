import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { User } from '../../src/models/User.js';
import { signToken, verifyToken } from '../../src/utils/token.js';
import { env } from '../../src/config/env.js';

describe('Security & Cryptography Unit Tests', () => {
  describe('Password Hashing & Verification (Bcrypt)', () => {
    it('should hash passwords and never store or match plaintext directly', async () => {
      const plaintext = 'SuperSecret123!';
      const hash = await User.hashPassword(plaintext);

      assert.notStrictEqual(hash, plaintext);
      assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'));
    });

    it('should produce different hashes for the same password due to random salting', async () => {
      const plaintext = 'IdenticalPassword123';
      const hash1 = await User.hashPassword(plaintext);
      const hash2 = await User.hashPassword(plaintext);

      assert.notStrictEqual(hash1, hash2);
    });

    it('should correctly verify candidate passwords against stored hash', async () => {
      const plaintext = 'CorrectPassword999';
      const wrongPassword = 'WrongPassword999';
      const hash = await User.hashPassword(plaintext);

      // Create model instance in memory
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: hash,
        role: 'user'
      });

      const isMatchCorrect = await user.comparePassword(plaintext);
      assert.strictEqual(isMatchCorrect, true);

      const isMatchWrong = await user.comparePassword(wrongPassword);
      assert.strictEqual(isMatchWrong, false);
    });

    it('should strip passwordHash from toSafeObject and toJSON representations', async () => {
      const hash = await User.hashPassword('MySecretPass123');
      const user = new User({
        name: 'Privacy Test',
        email: 'privacy@example.com',
        passwordHash: hash,
        role: 'user'
      });

      const safeObj = user.toSafeObject();
      assert.strictEqual(safeObj.passwordHash, undefined);
      assert.strictEqual(safeObj.name, 'Privacy Test');
      assert.strictEqual(safeObj.email, 'privacy@example.com');

      const jsonString = JSON.stringify(user);
      assert.strictEqual(jsonString.includes('passwordHash'), false);
    });
  });

  describe('JWT Signing & Verification', () => {
    it('should sign a token containing user id and role', () => {
      const mockUser = {
        _id: '651a7b8e4f1c9a0012345678',
        role: 'admin'
      };

      const token = signToken(mockUser);
      assert.ok(typeof token === 'string' && token.length > 20);

      const decoded = verifyToken(token);
      assert.strictEqual(decoded.id, '651a7b8e4f1c9a0012345678');
      assert.strictEqual(decoded.role, 'admin');
      assert.ok(decoded.exp > decoded.iat);
    });

    it('should sign a token containing canonical UUID id and role', () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        role: 'technician'
      };

      const token = signToken(mockUser);
      const decoded = verifyToken(token);
      assert.strictEqual(decoded.id, '123e4567-e89b-12d3-a456-426614174000');
      assert.strictEqual(decoded.role, 'technician');
    });

    it('should reject signing if user object is null or undefined', () => {
      assert.throws(
        () => signToken(null),
        { name: 'TypeError', message: 'Cannot sign JWT: user object is required.' }
      );
      assert.throws(
        () => signToken(undefined),
        { name: 'TypeError', message: 'Cannot sign JWT: user object is required.' }
      );
    });

    it('should reject signing if user.id and user._id are both missing', () => {
      assert.throws(
        () => signToken({ role: 'user' }),
        { name: 'TypeError', message: 'Cannot sign JWT: user.id or user._id is missing.' }
      );
    });

    it('should reject signing if user.role is missing', () => {
      assert.throws(
        () => signToken({ id: 'some-id' }),
        { name: 'TypeError', message: 'Cannot sign JWT: user.role is missing.' }
      );
    });

    it('should reject tampered or malformed tokens', () => {
      const mockUser = { _id: '12345', role: 'user' };
      const validToken = signToken(mockUser);
      const tamperedToken = validToken.slice(0, -6) + 'abcdef';

      assert.throws(
        () => {
          verifyToken(tamperedToken);
        },
        { name: 'JsonWebTokenError' }
      );
    });

    it('should reject expired tokens', () => {
      // Sign token with 0 second expiry
      const expiredToken = jwt.sign(
        { id: '123', role: 'user' },
        env.JWT_SECRET,
        { expiresIn: '0s' }
      );

      assert.throws(
        () => {
          verifyToken(expiredToken);
        },
        { name: 'TokenExpiredError' }
      );
    });
  });
});
