import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { signToken } from '../../src/utils/token.js';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env.js';

describe('Authentication & Authorization Integration Tests', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully and return JWT', async () => {
      const mockUser = new User({
        _id: '651a7b8e4f1c9a0012345678',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'user',
        isActive: true,
        passwordHash: 'dummy_hash'
      });

      mock.method(User, 'findOne', async () => null);
      mock.method(User, 'create', async (data) => {
        assert.strictEqual(data.role, 'user'); // Assert public register forces role 'user'
        return mockUser;
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'Password123!'
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user.email, 'jane@example.com');
      assert.strictEqual(res.body.data.user.role, 'user');
      assert.ok(res.body.data.token);
      assert.strictEqual(res.body.data.user.passwordHash, undefined); // Never expose hash
    });

    it('should strictly reject or ignore privileged roles from public registration', async () => {
      const mockUser = new User({
        _id: '651a7b8e4f1c9a0012345678',
        name: 'Hacker Wannabe',
        email: 'hacker@example.com',
        role: 'user',
        isActive: true
      });

      mock.method(User, 'findOne', async () => null);
      mock.method(User, 'create', async (data) => {
        // Must be forced to 'user' even though client requested 'admin'
        assert.strictEqual(data.role, 'user');
        return mockUser;
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Hacker Wannabe',
          email: 'hacker@example.com',
          password: 'Password123!',
          role: 'admin' // Attempted privilege escalation
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.user.role, 'user');
    });

    it('should reject registration if email is already registered (409 Conflict)', async () => {
      mock.method(User, 'findOne', async () => ({
        _id: 'existing_id',
        email: 'already@example.com'
      }));

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Already Registered',
          email: 'already@example.com',
          password: 'Password123!'
        });

      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'EMAIL_ALREADY_EXISTS');
    });

    it('should reject invalid registration data (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: '',
          email: 'bad-email',
          password: 'short'
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(res.body.error.details));
      assert.strictEqual(res.body.error.details.length, 3);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should successfully log in with valid credentials and return JWT', async () => {
      const mockUser = new User({
        _id: '651a7b8e4f1c9a0012345678',
        name: 'Login User',
        email: 'login@example.com',
        role: 'user',
        isActive: true,
        passwordHash: 'dummy_hash'
      });

      mock.method(mockUser, 'comparePassword', async () => true);

      // findOne returns query-like object supporting .select('+passwordHash')
      mock.method(User, 'findOne', () => ({
        select: () => mockUser
      }));

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'Password123!'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user.email, 'login@example.com');
      assert.ok(res.body.data.token);
    });

    it('should return 401 generic error on non-existent email', async () => {
      mock.method(User, 'findOne', () => ({
        select: () => null
      }));

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!'
        });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'INVALID_CREDENTIALS');
      assert.strictEqual(res.body.error.message, 'Invalid email or password.');
    });

    it('should return 401 generic error on incorrect password', async () => {
      const mockUser = new User({
        _id: '651a7b8e4f1c9a0012345678',
        name: 'User',
        email: 'user@example.com',
        role: 'user',
        isActive: true,
        passwordHash: 'hash'
      });

      mock.method(mockUser, 'comparePassword', async () => false);

      mock.method(User, 'findOne', () => ({
        select: () => mockUser
      }));

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: 'WrongPassword123!'
        });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'INVALID_CREDENTIALS');
      assert.strictEqual(res.body.error.message, 'Invalid email or password.');
    });
  });

  describe('GET /api/v1/auth/me (Protected Route)', () => {
    it('should reject access without token (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject access with malformed token (401 Unauthorized)', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'INVALID_TOKEN');
    });

    it('should reject access with expired token (401 Token Expired)', async () => {
      const expiredToken = jwt.sign(
        { id: '123', role: 'user' },
        env.JWT_SECRET,
        { expiresIn: '0s' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'TOKEN_EXPIRED');
    });

    it('should return safe user profile when valid token provided', async () => {
      const mockUser = new User({
        _id: '651a7b8e4f1c9a0012345678',
        name: 'Authenticated User',
        email: 'auth.user@example.com',
        role: 'user',
        isActive: true
      });

      const validToken = signToken(mockUser);
      mock.method(User, 'findById', async () => mockUser);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user.email, 'auth.user@example.com');
      assert.strictEqual(res.body.data.user.passwordHash, undefined);
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('should reject standard user accessing admin-only endpoint (403 Forbidden)', async () => {
      const standardUser = new User({
        _id: 'user_123',
        name: 'Regular Resident',
        email: 'resident@example.com',
        role: 'user',
        isActive: true
      });

      const userToken = signToken(standardUser);
      mock.method(User, 'findById', async () => standardUser);

      const res = await request(app)
        .get('/api/v1/auth/admin-check')
        .set('Authorization', `Bearer ${userToken}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });

    it('should permit admin accessing admin-only endpoint (200 OK)', async () => {
      const adminUser = new User({
        _id: 'admin_123',
        name: 'Facility Director',
        email: 'admin@example.com',
        role: 'admin',
        isActive: true
      });

      const adminToken = signToken(adminUser);
      mock.method(User, 'findById', async () => adminUser);

      const res = await request(app)
        .get('/api/v1/auth/admin-check')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.match(res.body.message, /Admin authorization verified/);
    });

    it('should permit technician accessing technician-check endpoint', async () => {
      const techUser = new User({
        _id: 'tech_123',
        name: 'Electrician Dave',
        email: 'tech@example.com',
        role: 'technician',
        isActive: true
      });

      const techToken = signToken(techUser);
      mock.method(User, 'findById', async () => techUser);

      const res = await request(app)
        .get('/api/v1/auth/technician-check')
        .set('Authorization', `Bearer ${techToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.match(res.body.message, /Technician authorization verified/);
    });

    it('should reject standard user accessing technician-check endpoint (403 Forbidden)', async () => {
      const standardUser = new User({
        _id: 'user_456',
        name: 'Student Sam',
        email: 'student@example.com',
        role: 'user',
        isActive: true
      });

      const userToken = signToken(standardUser);
      mock.method(User, 'findById', async () => standardUser);

      const res = await request(app)
        .get('/api/v1/auth/technician-check')
        .set('Authorization', `Bearer ${userToken}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });
  });

  describe('GET /api/v1/auth/technicians (Admin Only)', () => {
    it('should allow administrator to list active technicians', async () => {
      const adminUser = new User({
        _id: 'admin_123',
        name: 'Admin Alice',
        email: 'admin@example.com',
        role: 'admin',
        isActive: true
      });

      const mockTechnicians = [
        {
          _id: 'tech_1',
          name: 'Bob Spark',
          email: 'bob@example.com',
          role: 'technician',
          isActive: true
        }
      ];

      const adminToken = signToken(adminUser);
      mock.method(User, 'findById', async () => adminUser);
      mock.method(User, 'find', () => ({
        select: () => ({
          sort: () => ({
            lean: async () => mockTechnicians
          })
        })
      }));

      const res = await request(app)
        .get('/api/v1/auth/technicians')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.technicians.length, 1);
      assert.strictEqual(res.body.data.technicians[0].name, 'Bob Spark');
    });

    it('should reject non-administrator from listing technicians (403 Forbidden)', async () => {
      const standardUser = new User({
        _id: 'user_123',
        name: 'User Dave',
        email: 'dave@example.com',
        role: 'user',
        isActive: true
      });

      const userToken = signToken(standardUser);
      mock.method(User, 'findById', async () => standardUser);

      const res = await request(app)
        .get('/api/v1/auth/technicians')
        .set('Authorization', `Bearer ${userToken}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should return successful stateless logout guidance', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.match(res.body.message, /client must discard the token/);
    });
  });
});
