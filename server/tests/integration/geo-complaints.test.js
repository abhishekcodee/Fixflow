import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Complaint } from '../../src/models/Complaint.js';
import { signToken } from '../../src/utils/token.js';

describe('Geo Proximity & Radius Security Integration Tests', () => {
  const userId = '651a7b8e4f1c9a0012345678';
  const adminId = '651a7b8e4f1c9a0012345681';

  let userToken;
  let adminToken;
  let standardUser;
  let adminUser;

  const mockComplaints = [
    {
      id: 'c_near',
      _id: 'c_near',
      complaintNumber: 'FIX-202610-0001',
      title: 'Water leak in Lobby A',
      description: 'Lobby fountain is leaking.',
      category: 'plumbing',
      priority: 'high',
      status: 'submitted',
      latitude: 28.6150,
      longitude: 77.2090, // ~120m away from 28.6139, 77.2090
      location: {
        building: 'Lobby A',
        floor: '1',
        room: 'Reception',
        latitude: 28.6150,
        longitude: 77.2090
      },
      createdById: userId,
      createdAt: new Date()
    },
    {
      id: 'c_medium',
      _id: 'c_medium',
      complaintNumber: 'FIX-202610-0002',
      title: 'AC Broken in North Wing',
      description: 'Blower fan rattling.',
      category: 'hvac',
      priority: 'urgent',
      status: 'assigned',
      latitude: 28.6350,
      longitude: 77.2090, // ~2.3 km away
      location: {
        building: 'North Wing',
        floor: '3',
        room: '302',
        latitude: 28.6350,
        longitude: 77.2090
      },
      createdById: userId,
      createdAt: new Date()
    },
    {
      id: 'c_far',
      _id: 'c_far',
      complaintNumber: 'FIX-202610-0003',
      title: 'Power Outage across West Campus',
      description: 'Main breaker tripped.',
      category: 'electrical',
      priority: 'urgent',
      status: 'submitted',
      latitude: 28.7500,
      longitude: 77.2090, // ~15 km away
      location: {
        building: 'West Campus',
        floor: '1',
        room: 'Substation',
        latitude: 28.7500,
        longitude: 77.2090
      },
      createdById: userId,
      createdAt: new Date()
    }
  ];

  beforeEach(() => {
    mock.restoreAll();

    standardUser = new User({ _id: userId, name: 'Resident User', email: 'resident@fixflow.local', role: 'user', isActive: true });
    adminUser = new User({ _id: adminId, name: 'Admin Alice', email: 'admin@fixflow.local', role: 'admin', isActive: true });

    userToken = signToken(standardUser);
    adminToken = signToken(adminUser);

    mock.method(User, 'findById', async (id) => {
      const idStr = id?.toString();
      if (idStr === userId) return standardUser;
      if (idStr === adminId) return adminUser;
      return null;
    });

    mock.method(Complaint, 'find', () => ({
      sort: () => ({
        populate: () => ({
          populate: async () => mockComplaints
        })
      })
    }));
  });

  it('should filter incidents by radius and calculate distances for nearby queries', async () => {
    const res = await request(app)
      .get('/api/v1/complaints')
      .query({
        lat: 28.6139,
        lng: 77.2090,
        radius: 5,
        nearby: 'true'
      })
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    
    // Only c_near and c_medium are <= 5km; c_far (~15km) must be excluded
    assert.strictEqual(res.body.data.complaints.length, 2);
    assert.strictEqual(res.body.data.complaints[0].id, 'c_near');
    assert.strictEqual(res.body.data.complaints[1].id, 'c_medium');

    // Verify distance attributes
    assert.ok(typeof res.body.data.complaints[0].distanceKm === 'number');
    assert.ok(res.body.data.complaints[0].distanceFormatted.includes('m away') || res.body.data.complaints[0].distanceFormatted.includes('km away'));

    // Verify meta
    assert.strictEqual(res.body.meta.nearby.active, true);
    assert.strictEqual(res.body.meta.nearby.radiusKm, 5);
    assert.strictEqual(res.body.meta.nearby.totalWithinRadius, 2);
  });

  it('should enforce maximum 10 km radius for standard user preventing unauthorized expansion', async () => {
    const res = await request(app)
      .get('/api/v1/complaints')
      .query({
        lat: 28.6139,
        lng: 77.2090,
        radius: 50, // User requests 50km
        nearby: 'true'
      })
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 200);
    // Effective radius is capped at 10km, so 15km incident must still be excluded
    assert.strictEqual(res.body.meta.nearby.radiusKm, 10);
    assert.strictEqual(res.body.data.complaints.length, 2);
  });

  it('should reject invalid coordinates with 400 Bad Request', async () => {
    const res = await request(app)
      .get('/api/v1/complaints')
      .query({
        lat: 999, // Invalid latitude
        lng: 77.2090
      })
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'INVALID_QUERY_PARAMS');
  });

  it('should reject invalid radius exceeding allowed range with 400 Bad Request', async () => {
    const res = await request(app)
      .get('/api/v1/complaints')
      .query({
        lat: 28.6139,
        lng: 77.2090,
        radius: 100 // Exceeds 50km max range
      })
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 400);
  });
});
