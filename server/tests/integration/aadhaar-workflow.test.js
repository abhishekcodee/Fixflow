import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';

describe('Aadhaar Identity Verification Integration Workflow Suite', () => {
  let userToken = null;
  let userId = null;
  let adminToken = null;
  let adminId = null;
  let otherUserToken = null;
  let verificationRecordId = null;

  before(async () => {
    // Clean up any test users
    await prisma.aadhaarVerification.deleteMany({
      where: {
        user: {
          email: { in: ['aadhaar_test_user@example.com', 'aadhaar_admin_user@example.com', 'aadhaar_other_user@example.com'] },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: { in: ['aadhaar_test_user@example.com', 'aadhaar_admin_user@example.com', 'aadhaar_other_user@example.com'] },
      },
    });

    // 1. Create standard test user
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Aadhaar Test Citizen',
        email: 'aadhaar_test_user@example.com',
        password: 'Password123!',
      });
    assert.strictEqual(regRes.status, 201);
    userToken = regRes.body.data.token;
    userId = regRes.body.data.user.id || regRes.body.data.user._id;

    // 2. Create another user for isolation tests
    const otherRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Other Citizen',
        email: 'aadhaar_other_user@example.com',
        password: 'Password123!',
      });
    otherUserToken = otherRes.body.data.token;

    // 3. Create admin user
    const adminRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Super Admin',
        email: 'aadhaar_admin_user@example.com',
        password: 'Password123!',
        role: 'admin',
      });
    // Ensure role is admin in DB directly in case register forces user role
    await prisma.user.update({
      where: { id: adminRes.body.data.user.id || adminRes.body.data.user._id },
      data: { role: 'admin' },
    });
    // Login to get admin token with admin role in JWT
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'aadhaar_admin_user@example.com',
        password: 'Password123!',
      });
    adminToken = adminLogin.body.data.token;
    adminId = adminLogin.body.data.user.id;
  });

  after(async () => {
    await prisma.aadhaarVerification.deleteMany({
      where: {
        user: {
          email: { in: ['aadhaar_test_user@example.com', 'aadhaar_admin_user@example.com', 'aadhaar_other_user@example.com'] },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: { in: ['aadhaar_test_user@example.com', 'aadhaar_admin_user@example.com', 'aadhaar_other_user@example.com'] },
      },
    });
  });

  describe('Aadhaar OTP Initiation', () => {
    it('rejects initiation without authentication (401)', async () => {
      const res = await request(app)
        .post('/api/v1/identity/aadhaar/initiate')
        .send({
          aadhaarNumber: '987654321098',
          consent: true,
        });
      assert.strictEqual(res.status, 401);
    });

    it('rejects initiation without consent checkbox (400)', async () => {
      const res = await request(app)
        .post('/api/v1/identity/aadhaar/initiate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          aadhaarNumber: '987654321098',
          consent: false,
        });
      assert.strictEqual(res.status, 400);
      const msg = res.body.error?.message || res.body.message || '';
      assert.ok(msg.includes('consent'));
    });

    it('rejects invalid Aadhaar number formats starting with 0 or 1 (400)', async () => {
      const res = await request(app)
        .post('/api/v1/identity/aadhaar/initiate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          aadhaarNumber: '012345678901',
          consent: true,
        });
      assert.strictEqual(res.status, 400);
      const msg = res.body.error?.message || res.body.message || '';
      assert.ok(msg.includes('12-digit'));
    });

    it('initiates Aadhaar verification and returns masked number with pending fallback when provider credentials are not set', async () => {
      const res = await request(app)
        .post('/api/v1/identity/aadhaar/initiate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          aadhaarNumber: '9876 5432 1098',
          consent: true,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.maskedNumber, 'XXXX-XXXX-1098');
      assert.strictEqual(res.body.data.status, 'PENDING');
      // Must not expose raw Aadhaar anywhere
      assert.strictEqual(JSON.stringify(res.body).includes('987654321098'), false);
    });
  });

  describe('Document Upload & Vault Encryption', () => {
    it('rejects document upload without files (400)', async () => {
      const res = await request(app)
        .post('/api/v1/identity/aadhaar/upload-documents')
        .set('Authorization', `Bearer ${userToken}`);
      assert.strictEqual(res.status, 400);
    });

    it('uploads and encrypts front and back Aadhaar card images into secure private vault', async () => {
      const dummyFront = Buffer.from('RIFF....WEBPVP8 ... front image bytes');
      const dummyBack = Buffer.from('RIFF....WEBPVP8 ... back image bytes');

      const res = await request(app)
        .post('/api/v1/identity/aadhaar/upload-documents')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('frontImage', dummyFront, { filename: 'aadhaar_front.webp', contentType: 'image/webp' })
        .attach('backImage', dummyBack, { filename: 'aadhaar_back.webp', contentType: 'image/webp' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.maskedNumber, 'XXXX-XXXX-1098');
      assert.ok(
        res.body.data.status === 'DOCUMENTS_UPLOADED' || res.body.data.status === 'PENDING_REVIEW'
      );
    });

    it('allows owner to inspect verification status', async () => {
      const res = await request(app)
        .get('/api/v1/identity/aadhaar/status')
        .set('Authorization', `Bearer ${userToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.maskedNumber, 'XXXX-XXXX-1098');
      assert.strictEqual(res.body.data.hasFrontDocument, true);
      assert.strictEqual(res.body.data.hasBackDocument, true);
    });

    it('allows owner to securely stream decrypted document', async () => {
      const res = await request(app)
        .get('/api/v1/identity/aadhaar/documents/front')
        .set('Authorization', `Bearer ${userToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers['content-type'], 'image/webp');
      assert.ok(res.body.length > 0);
    });
  });

  describe('Admin Verification Governance & Review Queue', () => {
    it('blocks regular users from accessing admin verification list (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/identity-verifications')
        .set('Authorization', `Bearer ${userToken}`);
      assert.strictEqual(res.status, 403);
    });

    it('allows administrators to view the verification queue', async () => {
      const res = await request(app)
        .get('/api/v1/admin/identity-verifications')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.verifications));

      const found = res.body.data.verifications.find((v) => v.user.id === userId);
      assert.ok(found, 'Created user verification should be present in admin list');
      verificationRecordId = found.id;
      assert.strictEqual(found.aadhaarNumberMasked, 'XXXX-XXXX-1098');
      assert.strictEqual(found.user.email, 'aadhaar_test_user@example.com');
    });

    it('allows administrators to stream decrypted front & back document images for review', async () => {
      assert.ok(verificationRecordId);
      const res = await request(app)
        .get(`/api/v1/admin/identity-verifications/${verificationRecordId}/documents/front`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers['content-type'], 'image/webp');
    });

    it('rejects review if decision is reject without a rejection reason (400)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/identity-verifications/${verificationRecordId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'reject',
          rejectionReason: '',
        });

      assert.strictEqual(res.status, 400);
    });

    it('allows administrator to approve identity verification and updates user identityStatus', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/identity-verifications/${verificationRecordId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'approve',
          notes: 'Document matches user name and details completely.',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.status, 'VERIFIED');

      // Verify user model in DB now has identityStatus = 'verified'
      const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
      assert.strictEqual(updatedUser.identityStatus, 'verified');
    });
  });
});
