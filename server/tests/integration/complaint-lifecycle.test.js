import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Complaint } from '../../src/models/Complaint.js';
import { ComplaintHistory } from '../../src/models/ComplaintHistory.js';
import { Counter } from '../../src/models/Counter.js';
import { signToken } from '../../src/utils/token.js';

describe('Complaint Lifecycle & Work Orders Integration Tests', () => {
  const userId = '651a7b8e4f1c9a0012345678';
  const otherUserId = '651a7b8e4f1c9a0012345679';
  const technicianId = '651a7b8e4f1c9a0012345680';
  const adminId = '651a7b8e4f1c9a0012345681';
  const complaintId = '651a7b8e4f1c9a0099999999';

  let userToken;
  let otherUserToken;
  let technicianToken;
  let adminToken;

  let standardUser;
  let otherUser;
  let technicianUser;
  let adminUser;

  beforeEach(() => {
    mock.restoreAll();

    standardUser = new User({ _id: userId, name: 'Normal User', email: 'user@fixflow.local', role: 'user', isActive: true });
    otherUser = new User({ _id: otherUserId, name: 'Other User', email: 'other@fixflow.local', role: 'user', isActive: true });
    technicianUser = new User({ _id: technicianId, name: 'Tech Dave', email: 'tech@fixflow.local', role: 'technician', isActive: true });
    adminUser = new User({ _id: adminId, name: 'Admin Alice', email: 'admin@fixflow.local', role: 'admin', isActive: true });

    userToken = signToken(standardUser);
    otherUserToken = signToken(otherUser);
    technicianToken = signToken(technicianUser);
    adminToken = signToken(adminUser);

    // Default User.findById mock for auth middleware
    mock.method(User, 'findById', async (id) => {
      const idStr = id?.toString();
      if (idStr === userId) return standardUser;
      if (idStr === otherUserId) return otherUser;
      if (idStr === technicianId) return technicianUser;
      if (idStr === adminId) return adminUser;
      return null;
    });

    // Default Counter mock for complaint numbering
    mock.method(Counter, 'findOneAndUpdate', async () => ({ seq: 42 }));

    // Default ComplaintHistory mock
    mock.method(ComplaintHistory, 'create', async (data) => data);
  });

  describe('POST /api/v1/complaints (Creation)', () => {
    const validBody = {
      title: 'Air conditioning leaking water in office',
      description: 'The indoor blower unit is dripping water onto the desk below.',
      category: 'hvac',
      priority: 'high',
      location: {
        building: 'North Block',
        floor: '2',
        room: '201'
      }
    };

    it('should create complaint, assign number, set submitted status, and log CREATED event', async () => {
      let createdData = null;
      mock.method(Complaint, 'create', async (data) => {
        createdData = data;
        return new Complaint({
          _id: complaintId,
          ...data
        });
      });

      let historyLogged = null;
      mock.method(ComplaintHistory, 'create', async (data) => {
        historyLogged = data;
        return data;
      });

      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validBody);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.complaint.title, validBody.title);
      assert.strictEqual(res.body.data.complaint.status, 'submitted');
      assert.strictEqual(res.body.data.complaint.createdBy, userId);
      assert.ok(res.body.data.complaint.complaintNumber.startsWith('FIX-'));

      assert.ok(historyLogged);
      assert.strictEqual(historyLogged.action, 'CREATED');
    });

    it('should reject complaint creation with invalid input (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Fix',
          description: 'Short',
          category: 'invalid_cat'
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('should reject unauthenticated request (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .send(validBody);

      assert.strictEqual(res.status, 401);
    });
  });

  describe('GET /api/v1/complaints (Role-Scoped List)', () => {
    it('should scope list to createdBy for normal users', async () => {
      let capturedQuery = null;

      mock.method(Complaint, 'find', (query) => {
        capturedQuery = query;
        return {
          sort: () => ({
            skip: () => ({
              limit: () => ({
                populate: () => ({
                  populate: async () => []
                })
              })
            })
          })
        };
      });

      mock.method(Complaint, 'countDocuments', async () => 0);

      const res = await request(app)
        .get('/api/v1/complaints?page=1&limit=10&status=submitted')
        .set('Authorization', `Bearer ${userToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(capturedQuery.createdBy, userId);
      assert.strictEqual(capturedQuery.status, 'submitted');
    });

    it('should scope list to assignedTo for technicians', async () => {
      let capturedQuery = null;

      mock.method(Complaint, 'find', (query) => {
        capturedQuery = query;
        return {
          sort: () => ({
            skip: () => ({
              limit: () => ({
                populate: () => ({
                  populate: async () => []
                })
              })
            })
          })
        };
      });

      mock.method(Complaint, 'countDocuments', async () => 0);

      const res = await request(app)
        .get('/api/v1/complaints')
        .set('Authorization', `Bearer ${technicianToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(capturedQuery.assignedTo, technicianId);
    });

    it('should allow administrators to view all complaints without automatic scoping', async () => {
      let capturedQuery = null;

      mock.method(Complaint, 'find', (query) => {
        capturedQuery = query;
        return {
          sort: () => ({
            skip: () => ({
              limit: () => ({
                populate: () => ({
                  populate: async () => []
                })
              })
            })
          })
        };
      });

      mock.method(Complaint, 'countDocuments', async () => 0);

      const res = await request(app)
        .get('/api/v1/complaints')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(capturedQuery.createdBy, undefined);
      assert.strictEqual(capturedQuery.assignedTo, undefined);
    });

    it('should reject invalid pagination limit exceeding maximum of 50', async () => {
      const res = await request(app)
        .get('/api/v1/complaints?limit=100')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'INVALID_QUERY_PARAMS');
    });
  });

  describe('GET /api/v1/complaints/:id (Single Item Authorization)', () => {
    it('should allow creator to view their own complaint', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        complaintNumber: 'FIX-202610-0001',
        title: 'Broken window latch',
        description: 'Window cannot be locked securely.',
        category: 'carpentry',
        priority: 'medium',
        status: 'submitted',
        location: { building: 'A', floor: '1', room: '101' },
        createdBy: userId,
        assignedTo: null
      });

      mock.method(Complaint, 'findById', () => ({
        populate: () => ({
          populate: async () => mockComplaint
        })
      }));

      const res = await request(app)
        .get(`/api/v1/complaints/${complaintId}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.complaint.title, 'Broken window latch');
    });

    it('should reject unrelated user from viewing another user complaint (403 Forbidden)', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        complaintNumber: 'FIX-202610-0001',
        title: 'Confidential Executive Issue',
        description: 'Details should not be visible to other tenants.',
        category: 'other',
        status: 'submitted',
        location: { building: 'A', floor: '1', room: '101' },
        createdBy: userId, // Belongs to standardUser, not otherUser
        assignedTo: null
      });

      mock.method(Complaint, 'findById', () => ({
        populate: () => ({
          populate: async () => mockComplaint
        })
      }));

      const res = await request(app)
        .get(`/api/v1/complaints/${complaintId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });

    it('should reject malformed ObjectId parameter (400 Bad Request)', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/not-a-valid-id')
        .set('Authorization', `Bearer ${userToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'INVALID_IDENTIFIER');
    });

    it('should return 404 if complaint does not exist', async () => {
      mock.method(Complaint, 'findById', () => ({
        populate: () => ({
          populate: async () => null
        })
      }));

      const res = await request(app)
        .get(`/api/v1/complaints/${complaintId}`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error.code, 'COMPLAINT_NOT_FOUND');
    });
  });

  describe('POST /api/v1/complaints/:id/assign (Admin Dispatch)', () => {
    it('should allow admin to assign a technician and transition submitted to assigned', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        complaintNumber: 'FIX-202610-0001',
        title: 'Electrical circuit breaker tripping',
        description: 'Breaker flips off when microwave runs.',
        category: 'electrical',
        priority: 'high',
        status: 'submitted',
        location: { building: 'A', floor: '1', room: '101' },
        createdBy: userId,
        assignedTo: null
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);
      mock.method(mockComplaint, 'save', async () => mockComplaint);

      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          technicianId,
          note: 'Assigned to senior electrician Dave.'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(mockComplaint.status, 'assigned');
      assert.strictEqual(mockComplaint.assignedTo.toString(), technicianId);
    });

    it('should reject assignment by non-admin user (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/assign`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ technicianId });

      assert.strictEqual(res.status, 403);
    });

    it('should reject assignment to user who is not a technician (400 Bad Request)', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        createdBy: userId,
        status: 'submitted',
        location: { building: 'A', floor: '1', room: '101' }
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);

      // Attempting to assign standardUser (role: 'user')
      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ technicianId: userId });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'INVALID_TECHNICIAN');
    });
  });

  describe('POST /api/v1/complaints/:id/status (Workflow State Machine)', () => {
    it('should allow assigned technician to move assigned complaint to in_progress', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        complaintNumber: 'FIX-202610-0001',
        title: 'Broken heater',
        description: 'Heater does not turn on.',
        category: 'hvac',
        status: 'assigned',
        location: { building: 'A', floor: '1', room: '101' },
        createdBy: userId,
        assignedTo: technicianId
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);
      mock.method(mockComplaint, 'save', async () => mockComplaint);

      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ status: 'in_progress', note: 'Arrived on site and opened unit.' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(mockComplaint.status, 'in_progress');
    });

    it('should reject unassigned technician from moving status to in_progress', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        status: 'assigned',
        createdBy: userId,
        assignedTo: otherUserId // Assigned to someone else
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);

      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ status: 'in_progress' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'INVALID_STATUS_TRANSITION');
    });

    it('should allow assigned technician to resolve complaint with resolution note', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        status: 'in_progress',
        location: { building: 'A', floor: '1', room: '101' },
        createdBy: userId,
        assignedTo: technicianId
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);
      mock.method(mockComplaint, 'save', async () => mockComplaint);

      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({
          status: 'resolved',
          note: 'Replaced faulty heating element. Unit tested and blowing hot air.'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(mockComplaint.status, 'resolved');
      assert.ok(mockComplaint.resolvedAt);
    });

    it('should allow creator user to confirm closure of resolved complaint', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        status: 'resolved',
        location: { building: 'A', floor: '1', room: '101' },
        createdBy: userId,
        assignedTo: technicianId
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);
      mock.method(mockComplaint, 'save', async () => mockComplaint);

      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'closed', note: 'Heating tested and confirmed working.' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(mockComplaint.status, 'closed');
      assert.ok(mockComplaint.closedAt);
    });

    it('should allow creator user to reopen an unsatisfied resolution with a note', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        status: 'resolved',
        location: { building: 'A', floor: '1', room: '101' },
        createdBy: userId,
        assignedTo: technicianId,
        resolvedAt: new Date()
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);
      mock.method(mockComplaint, 'save', async () => mockComplaint);

      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'in_progress', note: 'Heater failed again after 10 minutes.' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(mockComplaint.status, 'in_progress');
      assert.strictEqual(mockComplaint.resolvedAt, null); // Reset on reopen
    });

    it('should reject invalid status jump (e.g., submitted directly to closed)', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        status: 'submitted',
        createdBy: userId,
        assignedTo: null
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);

      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'closed' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'INVALID_STATUS_TRANSITION');
    });
  });

  describe('GET /api/v1/complaints/:id/history (Audit Trail)', () => {
    it('should return chronological history for authorized creator', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        createdBy: userId,
        assignedTo: technicianId
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);

      mock.method(ComplaintHistory, 'find', () => ({
        sort: () => ({
          populate: async () => [
            { action: 'CREATED', timestamp: new Date(1000) },
            { action: 'ASSIGNMENT_CHANGED', timestamp: new Date(2000) }
          ]
        })
      }));

      const res = await request(app)
        .get(`/api/v1/complaints/${complaintId}/history`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.history.length, 2);
    });

    it('should reject unauthorized user from viewing history (403 Forbidden)', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        createdBy: userId,
        assignedTo: technicianId
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);

      const res = await request(app)
        .get(`/api/v1/complaints/${complaintId}/history`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      assert.strictEqual(res.status, 403);
    });
  });

  describe('POST /api/v1/complaints/:id/feedback (Ratings & Closure Reviews)', () => {
    it('should allow creator to submit feedback on a resolved complaint', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        complaintNumber: 'FIX-202610-0099',
        title: 'Resolved AC repair',
        description: 'AC was leaking water and making noise.',
        category: 'hvac',
        priority: 'high',
        status: 'resolved',
        location: { building: 'East', floor: '3', room: '302' },
        createdBy: userId,
        assignedTo: technicianId,
        feedback: null
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);
      mock.method(mockComplaint, 'save', async () => mockComplaint);
      mock.method(ComplaintHistory, 'logEvent', async () => ({}));

      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/feedback`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5, comments: 'Fast response and excellent repair!' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.complaint.feedback.rating, 5);
      assert.strictEqual(res.body.data.complaint.feedback.comments, 'Fast response and excellent repair!');
    });

    it('should reject feedback submission by non-creator (403 Forbidden)', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        status: 'resolved',
        createdBy: userId,
        assignedTo: technicianId
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);

      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/feedback`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ rating: 4 });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });

    it('should reject feedback if complaint is not resolved or closed (400 Bad Request)', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        status: 'in_progress',
        createdBy: userId,
        assignedTo: technicianId
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);

      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/feedback`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'INVALID_STATUS_FOR_FEEDBACK');
    });

    it('should reject duplicate feedback if already submitted (409 Conflict)', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        status: 'resolved',
        createdBy: userId,
        assignedTo: technicianId,
        feedback: { rating: 5, comments: 'Already rated', submittedAt: new Date() }
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);

      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/feedback`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 3 });

      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.error.code, 'FEEDBACK_ALREADY_EXISTS');
    });

    it('should reject invalid ratings outside 1-5 range', async () => {
      const mockComplaint = new Complaint({
        _id: complaintId,
        status: 'resolved',
        createdBy: userId,
        assignedTo: technicianId
      });

      mock.method(Complaint, 'findById', async () => mockComplaint);

      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/feedback`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 0 });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
    });
  });
});
