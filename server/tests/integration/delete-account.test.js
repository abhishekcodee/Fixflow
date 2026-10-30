import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { User } from '../../src/models/User.js';
import { Complaint } from '../../src/models/Complaint.js';

describe('Account Deletion & Data Retention Suite', () => {
  let userToken = null;
  let testUserId = null;
  let complaintId = null;

  before(async () => {
    // Clean up test user if previously left
    await prisma.user.deleteMany({ where: { email: { in: ['del_test_user@example.com', 'del_tech_user@example.com'] } } });

    // 1. Create a test user
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Delete Target User',
        email: 'del_test_user@example.com',
        password: 'Password123!'
      });

    userToken = registerRes.body.data.token;
    testUserId = registerRes.body.data.user.id || registerRes.body.data.user._id;

    // 2. Create a complaint created by this user
    const complaintRes = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Broken Radiator Valve',
        description: 'Steam leaking from radiator valve in bedroom',
        category: 'hvac',
        priority: 'high',
        location: {
          building: 'Hall B',
          floor: '2',
          room: '204'
        }
      });

    assert.strictEqual(complaintRes.status, 201);
    complaintId = complaintRes.body.data.complaint?.id || complaintRes.body.data.complaint?._id || complaintRes.body.data.id;
  });

  after(async () => {
    if (complaintId) {
      await prisma.complaintHistory.deleteMany({ where: { complaintId } });
      await prisma.complaint.deleteMany({ where: { id: complaintId } });
    }
    await prisma.user.deleteMany({ where: { email: { contains: 'del_test_user' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'anonymized.fixflow.internal' } } });
  });

  it('should reject unauthenticated delete request (401)', async () => {
    const res = await request(app)
      .delete('/api/v1/auth/me')
      .send({ confirmation: 'DELETE' });

    assert.strictEqual(res.status, 401);
  });

  it('should reject request without DELETE confirmation text (400)', async () => {
    const res = await request(app)
      .delete('/api/v1/auth/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ confirmation: 'wrong' });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'INVALID_CONFIRMATION');
  });

  it('should reject request with incorrect password (401)', async () => {
    const res = await request(app)
      .delete('/api/v1/auth/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ confirmation: 'DELETE', password: 'WrongPassword999!' });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error.code, 'INVALID_PASSWORD');
  });

  it('should successfully delete and anonymize user, preserving their historical complaint', async () => {
    const res = await request(app)
      .delete('/api/v1/auth/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ confirmation: 'DELETE', password: 'Password123!' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    // 1. Verify user record in database has been anonymized and deactivated
    const updatedUser = await prisma.user.findUnique({ where: { id: testUserId } });
    assert.ok(updatedUser);
    assert.strictEqual(updatedUser.name, 'Former User');
    assert.strictEqual(updatedUser.isActive, false);
    assert.strictEqual(updatedUser.passwordHash, null);
    assert.ok(updatedUser.email.includes('@anonymized.fixflow.internal'));

    // 2. Verify deleted user cannot log in
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'del_test_user@example.com', password: 'Password123!' });
    assert.strictEqual(loginRes.status, 401);

    // 3. Verify historical complaint remains intact in database!
    const complaintInDb = await prisma.complaint.findUnique({ where: { id: complaintId } });
    assert.ok(complaintInDb);
    assert.strictEqual(complaintInDb.title, 'Broken Radiator Valve');
    assert.strictEqual(complaintInDb.createdById, testUserId);
  });
});
