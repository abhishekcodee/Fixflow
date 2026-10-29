import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { EmailVerification } from '../../src/models/EmailVerification.js';
import { PasswordReset } from '../../src/models/PasswordReset.js';
import emailService from '../../src/services/emailService.js';
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js';
import { AppError } from '../../src/utils/AppError.js';

describe('Real Database Authentication & Gmail OTP Verification Suite', () => {
  let isDbConnected = false;

  // In-memory fallback stores for environments without a live MySQL daemon (like GitHub Actions CI)
  const memVerifications = new Map();
  const memResets = new Map();
  const memUsers = new Map();

  function setupInMemoryMocks() {
    mock.method(EmailVerification, 'deleteMany', async () => {
      memVerifications.clear();
    });
    mock.method(EmailVerification, 'deleteOne', async (q = {}) => {
      if (q.email) memVerifications.delete(String(q.email).toLowerCase().trim());
    });
    mock.method(EmailVerification, 'findOne', async (q = {}) => {
      const key = q.email ? String(q.email).toLowerCase().trim() : null;
      if (!key) return null;
      const item = memVerifications.get(key);
      if (!item) return null;
      return {
        ...item,
        compareOtp: async (cand) => bcrypt.compare(String(cand).trim(), item.otpHash),
        save: async function () {
          memVerifications.set(key, { ...this });
          return this;
        }
      };
    });
    mock.method(EmailVerification, 'create', async (data) => {
      const key = String(data.email).toLowerCase().trim();
      const record = {
        ...data,
        email: key,
        attempts: data.attempts || 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      memVerifications.set(key, record);
      return {
        ...record,
        compareOtp: async (cand) => bcrypt.compare(String(cand).trim(), record.otpHash),
        save: async function () {
          memVerifications.set(key, { ...this });
          return this;
        }
      };
    });
    mock.method(EmailVerification, 'findOneAndUpdate', async (filter, update) => {
      const key = filter.email ? String(filter.email).toLowerCase().trim() : null;
      if (!key) return null;
      const existing = memVerifications.get(key) || {};
      const updated = {
        ...existing,
        ...update,
        email: key,
        attempts: update.attempts !== undefined ? update.attempts : (existing.attempts || 0),
        updatedAt: new Date()
      };
      memVerifications.set(key, updated);
      return {
        ...updated,
        compareOtp: async (cand) => bcrypt.compare(String(cand).trim(), updated.otpHash),
        save: async function () {
          memVerifications.set(key, { ...this });
          return this;
        }
      };
    });

    mock.method(PasswordReset, 'deleteMany', async () => {
      memResets.clear();
    });
    mock.method(PasswordReset, 'deleteOne', async (q = {}) => {
      if (q.email) memResets.delete(String(q.email).toLowerCase().trim());
    });
    mock.method(PasswordReset, 'findOne', async (q = {}) => {
      const key = q.email ? String(q.email).toLowerCase().trim() : null;
      if (!key) return null;
      const item = memResets.get(key);
      if (!item) return null;
      return {
        ...item,
        compareToken: async (cand) => bcrypt.compare(String(cand).trim(), item.tokenHash),
        save: async function () {
          memResets.set(key, { ...this });
          return this;
        }
      };
    });
    mock.method(PasswordReset, 'findOneAndUpdate', async (filter, update) => {
      const key = filter.email ? String(filter.email).toLowerCase().trim() : null;
      if (!key) return null;
      const existing = memResets.get(key) || {};
      const updated = {
        ...existing,
        ...update,
        email: key,
        attempts: update.attempts !== undefined ? update.attempts : (existing.attempts || 0),
        updatedAt: new Date()
      };
      memResets.set(key, updated);
      return {
        ...updated,
        compareToken: async (cand) => bcrypt.compare(String(cand).trim(), updated.tokenHash),
        save: async function () {
          memResets.set(key, { ...this });
          return this;
        }
      };
    });

    mock.method(User, 'deleteMany', async () => {
      memUsers.clear();
    });
    mock.method(User, 'findOne', (q = {}) => {
      const key = q.email ? String(q.email).toLowerCase().trim() : null;
      const found = key ? memUsers.get(key) : null;
      const userObj = found
        ? {
          ...found,
          id: found.id || 'u_' + Math.random().toString(36).substring(7),
          _id: found.id || 'u_' + Math.random().toString(36).substring(7),
          comparePassword: async (pwd) => bcrypt.compare(pwd, found.passwordHash),
          select: function () { return this; }
        }
        : null;

      return {
        select: () => userObj,
        then: (resolve) => resolve(userObj)
      };
    });
    mock.method(User, 'create', async (data) => {
      const key = String(data.email).toLowerCase().trim();
      const user = {
        ...data,
        email: key,
        id: data.id || 'u_' + Math.random().toString(36).substring(7),
        _id: data.id || 'u_' + Math.random().toString(36).substring(7),
        isActive: true,
        isVerified: data.isVerified !== undefined ? data.isVerified : false,
        role: data.role || data.pendingRole || 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      user.comparePassword = async (pwd) => bcrypt.compare(pwd, user.passwordHash || user.pendingPasswordHash);
      user.select = function () { return this; };
      memUsers.set(key, user);
      return user;
    });
  }

  before(async () => {
    try {
      const connected = await connectDatabase();
      if (connected) {
        isDbConnected = true;
        await EmailVerification.deleteMany({});
        await PasswordReset.deleteMany({});
        await User.deleteMany({ email: { $in: ['test_otp@example.com', 'reset_user@example.com', 'candidate@example.com', 'test_tech_reg@example.com'] } });
      } else {
        isDbConnected = false;
        setupInMemoryMocks();
      }
    } catch {
      isDbConnected = false;
      setupInMemoryMocks();
    }
  });

  after(async () => {
    if (isDbConnected) {
      try {
        await EmailVerification.deleteMany({});
        await PasswordReset.deleteMany({});
        await User.deleteMany({ email: { $in: ['test_otp@example.com', 'reset_user@example.com', 'candidate@example.com', 'test_tech_reg@example.com'] } });
        await disconnectDatabase();
      } catch {
        // Ignore disconnect errors
      }
    }
  });

  beforeEach(() => {
    mock.restoreAll();
    if (!isDbConnected) {
      setupInMemoryMocks();
    }
  });

  describe('POST /api/v1/auth/send-otp', () => {
    it('should reject registration if email is already verified', async () => {
      mock.method(User, 'findOne', async ({ email }) => {
        if (email === 'verified@example.com') {
          return { email, isVerified: true };
        }
        return null;
      });

      const res = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({
          name: 'Verified User',
          email: 'verified@example.com',
          password: 'Password123!'
        });

      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'EMAIL_ALREADY_EXISTS');
    });

    it('should report missing Gmail SMTP configuration if credentials not set', async () => {
      mock.method(User, 'findOne', async () => null);
      mock.method(emailService, 'sendVerificationOtpEmail', async () => {
        throw new AppError(
          'Gmail SMTP service is not configured. Please set SMTP_USER and SMTP_PASS (Google App Password) in server/.env.',
          503,
          'EMAIL_SERVICE_NOT_CONFIGURED'
        );
      });

      const res = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({
          name: 'New Candidate',
          email: 'candidate@example.com',
          password: 'Password123!'
        });

      assert.strictEqual(res.status, 503);
      assert.strictEqual(res.body.error.code, 'EMAIL_SERVICE_NOT_CONFIGURED');
      assert.match(res.body.error.message, /Gmail SMTP/);
    });

    it('should generate OTP, hash it, store pending verification, and dispatch email when configured', async () => {
      let sentTo = null;
      let sentOtp = null;

      mock.method(User, 'findOne', async () => null);
      mock.method(emailService, 'sendVerificationOtpEmail', async ({ to, otp }) => {
        sentTo = to;
        sentOtp = otp;
        return { messageId: 'mock-msg-1234' };
      });

      const res = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({
          name: 'Jane Candidate',
          email: 'test_otp@example.com',
          password: 'Password123!'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(sentTo, 'test_otp@example.com');
      assert.ok(/^\d{6}$/.test(sentOtp)); // Cryptographically secure 6-digit numeric code
      assert.strictEqual(res.body.data.otp, undefined); // Never return OTP in HTTP response

      // Verify record exists in real database
      const record = await EmailVerification.findOne({ email: 'test_otp@example.com' });
      assert.ok(record);
      assert.strictEqual(record.pendingName, 'Jane Candidate');
      assert.notStrictEqual(record.otpHash, sentOtp); // Stored as bcrypt hash, never plaintext
      const isMatch = await record.compareOtp(sentOtp);
      assert.strictEqual(isMatch, true);
    });

    it('should enforce 60-second resend cooldown', async () => {
      mock.method(User, 'findOne', async () => null);

      const res = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({
          name: 'Jane Candidate',
          email: 'test_otp@example.com',
          password: 'Password123!'
        });

      assert.strictEqual(res.status, 429);
      assert.strictEqual(res.body.error.code, 'RESEND_COOLDOWN');
    });
  });

  describe('POST /api/v1/auth/verify-otp', () => {
    it('should reject incorrect OTP and decrement remaining attempts', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          email: 'test_otp@example.com',
          otp: '000000'
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'INVALID_OTP');
      assert.match(res.body.error.message, /remaining/i);

      const record = await EmailVerification.findOne({ email: 'test_otp@example.com' });
      assert.strictEqual(record.attempts, 1);
    });

    it('should enforce attempt limits after 5 failures and invalidate OTP', async () => {
      const record = await EmailVerification.findOne({ email: 'test_otp@example.com' });
      record.attempts = 5;
      await record.save();

      const res = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          email: 'test_otp@example.com',
          otp: '123456'
        });

      assert.strictEqual(res.status, 429);
      assert.strictEqual(res.body.error.code, 'TOO_MANY_ATTEMPTS');

      // Staged record should be deleted
      const afterRecord = await EmailVerification.findOne({ email: 'test_otp@example.com' });
      assert.strictEqual(afterRecord, null);
    });

    it('should reject expired OTP or non-existent verification request', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          email: 'unknown@example.com',
          otp: '999999'
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'OTP_EXPIRED_OR_INVALID');
    });

    it('should accept valid OTP, create real verified user in database, and issue JWT', async () => {
      const rawOtp = '654321';
      const otpHash = await EmailVerification.hashOtp(rawOtp);
      const pendingPasswordHash = await User.hashPassword('Secret123!');

      await EmailVerification.create({
        email: 'test_otp@example.com',
        otpHash,
        pendingName: 'Test Verified User',
        pendingPasswordHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });

      const res = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          email: 'test_otp@example.com',
          otp: rawOtp
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.strictEqual(res.body.data.user.email, 'test_otp@example.com');
      assert.strictEqual(res.body.data.user.isVerified, true);

      // Verify record in database
      const dbUser = await User.findOne({ email: 'test_otp@example.com' });
      assert.ok(dbUser);
      assert.strictEqual(dbUser.isVerified, true);
      assert.strictEqual(dbUser.role, 'user');

      // Verify OTP record is destroyed (single-use)
      const afterRecord = await EmailVerification.findOne({ email: 'test_otp@example.com' });
      assert.strictEqual(afterRecord, null);
    });

    it('should create user with technician role when technician role is requested', async () => {
      const rawOtp = '777888';
      const otpHash = await EmailVerification.hashOtp(rawOtp);
      const pendingPasswordHash = await User.hashPassword('TechPassword123!');

      await EmailVerification.create({
        email: 'test_tech_reg@example.com',
        otpHash,
        pendingName: 'Tech Jordan',
        pendingPasswordHash,
        pendingRole: 'technician',
        attempts: 0,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });

      const res = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          email: 'test_tech_reg@example.com',
          otp: rawOtp
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.user.role, 'technician');

      const dbUser = await User.findOne({ email: 'test_tech_reg@example.com' });
      assert.ok(dbUser);
      assert.strictEqual(dbUser.role, 'technician');
    });
  });

  describe('POST /api/v1/auth/forgot-password & /reset-password', () => {
    before(async () => {
      const passwordHash = await User.hashPassword('OldPassword123!');
      await User.create({
        name: 'Reset Candidate',
        email: 'reset_user@example.com',
        passwordHash,
        role: 'user',
        isVerified: true
      });
    });

    it('should return generic success message on forgot password even if user does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody_here@example.com' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.match(res.body.message, /If an account exists/i);
    });

    it('should generate reset code and dispatch email when user exists and SMTP is configured', async () => {
      let sentCode = null;
      mock.method(emailService, 'sendPasswordResetEmail', async ({ resetCode }) => {
        sentCode = resetCode;
        return { messageId: 'reset-msg-123' };
      });

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'reset_user@example.com' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(/^\d{6}$/.test(sentCode));

      const resetRecord = await PasswordReset.findOne({ email: 'reset_user@example.com' });
      assert.ok(resetRecord);
      const isMatch = await resetRecord.compareToken(sentCode);
      assert.strictEqual(isMatch, true);
    });

    it('should reject reset code if code is incorrect', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: 'reset_user@example.com',
          token: '000000',
          newPassword: 'NewPassword123!'
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'INVALID_CODE');
    });

    it('should update user password in database when valid reset code is submitted', async () => {
      const rawCode = '777888';
      const tokenHash = await PasswordReset.hashToken(rawCode);

      await PasswordReset.findOneAndUpdate(
        { email: 'reset_user@example.com' },
        {
          email: 'reset_user@example.com',
          tokenHash,
          attempts: 0,
          used: false,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        },
        { upsert: true }
      );

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: 'reset_user@example.com',
          token: rawCode,
          newPassword: 'BrandNewPassword123!'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      // Verify user can now log in with the new password
      const user = await User.findOne({ email: 'reset_user@example.com' }).select('+passwordHash');
      const isNewMatch = await user.comparePassword('BrandNewPassword123!');
      assert.strictEqual(isNewMatch, true);

      // Verify reset record is removed/consumed
      const record = await PasswordReset.findOne({ email: 'reset_user@example.com' });
      assert.strictEqual(record, null);
    });
  });
});
