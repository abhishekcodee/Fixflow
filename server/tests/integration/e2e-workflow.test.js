import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Complaint } from '../../src/models/Complaint.js';
import { ComplaintHistory } from '../../src/models/ComplaintHistory.js';
import { signToken } from '../../src/utils/token.js';
import bcrypt from 'bcryptjs';

describe('End-to-End Workflow & Quality Assurance Suite', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  const userId = '651a7b8e4f1c9a0011111111';
  const adminId = '651a7b8e4f1c9a0022222222';
  const technicianId = '651a7b8e4f1c9a0033333333';
  const outsiderId = '651a7b8e4f1c9a0044444444';
  const complaintId = '651a7b8e4f1c9a0055555555';

  const userToken = signToken({ id: userId, role: 'user' });
  const adminToken = signToken({ id: adminId, role: 'admin' });
  const technicianToken = signToken({ id: technicianId, role: 'technician' });
  const outsiderToken = signToken({ id: outsiderId, role: 'user' });

  // Users
  const normalUser = new User({
    _id: userId,
    name: 'Sarah Requester',
    email: 'sarah@fixflow.com',
    role: 'user',
    isActive: true,
  });

  const adminUser = new User({
    _id: adminId,
    name: 'David Dispatcher',
    email: 'david@fixflow.com',
    role: 'admin',
    isActive: true,
  });

  const technicianUser = new User({
    _id: technicianId,
    name: 'Ted Technician',
    email: 'ted@fixflow.com',
    role: 'technician',
    isActive: true,
  });

  const outsiderUser = new User({
    _id: outsiderId,
    name: 'Unrelated User',
    email: 'outsider@fixflow.com',
    role: 'user',
    isActive: true,
  });

  const wrapComplaintQuery = (doc) => ({
    populate: () => ({
      populate: async () => doc
    }),
    then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject)
  });

  it('verifies the full 10-step lifecycle end-to-end across roles', async () => {
    // 1. Normal user authentication
    mock.method(User, 'findById', async (id) => {
      if (id.toString() === userId) return normalUser;
      if (id.toString() === adminId) return adminUser;
      if (id.toString() === technicianId) return technicianUser;
      return null;
    });

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${userToken}`);
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.data.user.name, 'Sarah Requester');
    assert.strictEqual(meRes.body.data.user.role, 'user');

    // 2. User creates a maintenance complaint
    const complaintData = {
      title: 'Water pipe leak in server corridor',
      description: 'Major leak dripping through ceiling tile near power distribution rack.',
      category: 'plumbing',
      priority: 'urgent',
      location: {
        building: 'Data Center B',
        floor: '2',
        room: 'Server Bay 4',
        description: 'Requires badge clearance'
      }
    };

    const complaintDoc = new Complaint({
      _id: complaintId,
      complaintNumber: 'FIX-202610-0088',
      ...complaintData,
      status: 'submitted',
      createdBy: userId,
      assignedTo: null,
      feedback: null
    });

    mock.method(Complaint, 'create', async () => complaintDoc);
    mock.method(ComplaintHistory, 'logEvent', async () => ({}));

    const createRes = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${userToken}`)
      .send(complaintData);

    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.data.complaint.title, 'Water pipe leak in server corridor');
    assert.strictEqual(createRes.body.data.complaint.status, 'submitted');

    // 3. Complaint appears in user complaint list
    mock.method(Complaint, 'find', () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            populate: () => ({
              populate: async () => [complaintDoc]
            })
          })
        })
      })
    }));
    mock.method(Complaint, 'countDocuments', async () => 1);

    const userListRes = await request(app)
      .get('/api/v1/complaints')
      .set('Authorization', `Bearer ${userToken}`);
    assert.strictEqual(userListRes.status, 200);
    assert.strictEqual(userListRes.body.data.complaints.length, 1);
    assert.strictEqual(userListRes.body.data.complaints[0].complaintNumber, 'FIX-202610-0088');

    // 4. Administrator signs in and loads unassigned queue
    const adminQueueRes = await request(app)
      .get('/api/v1/complaints?status=submitted')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(adminQueueRes.status, 200);

    // 5. Administrator checks active technicians and assigns Ted Technician
    mock.method(User, 'find', () => ({
      select: () => ({
        sort: () => ({
          lean: async () => [technicianUser]
        })
      })
    }));

    const techsRes = await request(app)
      .get('/api/v1/auth/technicians')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(techsRes.status, 200);
    assert.strictEqual(techsRes.body.data.technicians[0].name, 'Ted Technician');

    // Dispatch assignment
    mock.method(Complaint, 'findById', () => wrapComplaintQuery(complaintDoc));
    mock.method(complaintDoc, 'save', async () => complaintDoc);

    const assignRes = await request(app)
      .post(`/api/v1/complaints/${complaintId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ technicianId, note: 'Urgent callout: assess corridor leak immediately.' });

    assert.strictEqual(assignRes.status, 200);
    assert.strictEqual(complaintDoc.status, 'assigned');
    assert.strictEqual(complaintDoc.assignedTo.toString(), technicianId);

    // 6. Technician signs in and verifies assigned work order
    const techListRes = await request(app)
      .get('/api/v1/complaints')
      .set('Authorization', `Bearer ${technicianToken}`);
    assert.strictEqual(techListRes.status, 200);

    // 7. Technician advances status: assigned -> in_progress
    const startRes = await request(app)
      .post(`/api/v1/complaints/${complaintId}/status`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .send({ status: 'in_progress' });

    assert.strictEqual(startRes.status, 200);
    assert.strictEqual(complaintDoc.status, 'in_progress');

    // Technician advances status: in_progress -> resolved
    const resolveRes = await request(app)
      .post(`/api/v1/complaints/${complaintId}/status`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .send({ status: 'resolved', note: 'Replaced faulty coupling and dried server floor.' });

    assert.strictEqual(resolveRes.status, 200);
    assert.strictEqual(complaintDoc.status, 'resolved');
    assert.strictEqual(complaintDoc.resolutionNotes, 'Replaced faulty coupling and dried server floor.');

    // 8. Verify audit history records the transition events
    const mockHistoryEntries = [
      { action: 'CREATED', actor: { name: 'Sarah Requester' }, timestamp: new Date(1000) },
      { action: 'ASSIGNMENT_CHANGED', actor: { name: 'David Dispatcher' }, timestamp: new Date(2000) },
      { action: 'STATUS_CHANGED', actor: { name: 'Ted Technician' }, timestamp: new Date(3000) },
      { action: 'RESOLVED', actor: { name: 'Ted Technician' }, timestamp: new Date(4000) }
    ];

    mock.method(ComplaintHistory, 'find', () => ({
      sort: () => ({
        populate: async () => mockHistoryEntries
      })
    }));

    const historyRes = await request(app)
      .get(`/api/v1/complaints/${complaintId}/history`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(historyRes.status, 200);
    assert.strictEqual(historyRes.body.data.history.length, 4);

    // 9. User verifies resolved status and confirms closure (resolved -> closed)
    const closeRes = await request(app)
      .post(`/api/v1/complaints/${complaintId}/status`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'closed', note: 'Water is completely cleared. Verified and closed.' });

    assert.strictEqual(closeRes.status, 200);
    assert.strictEqual(complaintDoc.status, 'closed');

    // 10. User provides feedback and 5-star rating on the closed ticket
    const feedbackRes = await request(app)
      .post(`/api/v1/complaints/${complaintId}/feedback`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ rating: 5, comments: 'Extremely prompt response, saved critical equipment!' });

    assert.strictEqual(feedbackRes.status, 200);
    assert.strictEqual(feedbackRes.body.success, true);
    assert.strictEqual(complaintDoc.feedback.rating, 5);
    assert.strictEqual(complaintDoc.feedback.comments, 'Extremely prompt response, saved critical equipment!');
  });

  describe('Authorization & Negative Security Tests', () => {
    const mockComplaint = new Complaint({
      _id: complaintId,
      complaintNumber: 'FIX-202610-0088',
      title: 'Water pipe leak in server corridor',
      description: 'Major leak dripping through ceiling tile near power distribution rack.',
      category: 'plumbing',
      priority: 'urgent',
      status: 'assigned',
      location: { building: 'Data Center B', floor: '2', room: 'Server Bay 4' },
      createdBy: userId,
      assignedTo: technicianId
    });

    beforeEach(() => {
      mock.method(User, 'findById', async (id) => {
        if (id.toString() === userId) return normalUser;
        if (id.toString() === adminId) return adminUser;
        if (id.toString() === technicianId) return technicianUser;
        if (id.toString() === outsiderId) return outsiderUser;
        return null;
      });
      mock.method(Complaint, 'findById', () => wrapComplaintQuery(mockComplaint));
    });

    it('rejects unauthenticated requests to protected endpoints', async () => {
      const res = await request(app).get('/api/v1/complaints');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    });

    it('denies standard user from accessing private complaint belonging to someone else', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/${complaintId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });

    it('denies standard user from performing admin technician dispatch', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/assign`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ technicianId });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });

    it('denies unassigned technician from modifying work order status', async () => {
      const otherTechToken = signToken({ id: outsiderId, role: 'technician' });

      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${otherTechToken}`)
        .send({ status: 'in_progress' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'INVALID_STATUS_TRANSITION');
    });

    it('rejects invalid status transitions (e.g. assigned directly to closed)', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'closed' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'INVALID_STATUS_TRANSITION');
    });

    it('rejects feedback from unauthorized users', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${complaintId}/feedback`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ rating: 5 });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });
  });
});
