import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCoordinate,
  calculateDistanceKm,
  formatDistance,
  filterComplaintsByRadius
} from '../../src/utils/geo.js';

describe('Geographical Calculation & Radius Filtering (Haversine)', () => {
  describe('isValidCoordinate', () => {
    it('should validate valid coordinates', () => {
      assert.strictEqual(isValidCoordinate(28.6139, 77.2090), true);
      assert.strictEqual(isValidCoordinate(0, 0), true);
      assert.strictEqual(isValidCoordinate(-90, 180), true);
      assert.strictEqual(isValidCoordinate('19.0760', '72.8777'), true);
    });

    it('should reject invalid coordinates', () => {
      assert.strictEqual(isValidCoordinate(95, 77), false);
      assert.strictEqual(isValidCoordinate(28, 200), false);
      assert.strictEqual(isValidCoordinate('abc', 77), false);
      assert.strictEqual(isValidCoordinate(null, undefined), false);
    });
  });

  describe('calculateDistanceKm', () => {
    it('should return 0 for identical points', () => {
      const dist = calculateDistanceKm(28.6139, 77.2090, 28.6139, 77.2090);
      assert.strictEqual(dist, 0);
    });

    it('should accurately calculate distance between Delhi and Mumbai (~1150-1170 km)', () => {
      // Delhi: 28.6139, 77.2090
      // Mumbai: 19.0760, 72.8777
      const dist = calculateDistanceKm(28.6139, 77.2090, 19.0760, 72.8777);
      assert.ok(dist > 1140 && dist < 1180, `Expected ~1160km, got ${dist}`);
    });

    it('should calculate short campus distances (~100m - 1km)', () => {
      // Offset by ~0.005 lat (~550 meters)
      const dist = calculateDistanceKm(28.6139, 77.2090, 28.6189, 77.2090);
      assert.ok(dist >= 0.5 && dist <= 0.6, `Expected ~0.55km, got ${dist}`);
    });
  });

  describe('formatDistance', () => {
    it('should format meters for sub-kilometer distances', () => {
      assert.strictEqual(formatDistance(0.05), '50 m away');
      assert.strictEqual(formatDistance(0.45), '450 m away');
    });

    it('should format kilometers for distances >= 1 km', () => {
      assert.strictEqual(formatDistance(1.234), '1.2 km away');
      assert.strictEqual(formatDistance(5.0), '5.0 km away');
    });
  });

  describe('filterComplaintsByRadius', () => {
    const center = { lat: 28.6139, lng: 77.2090 };
    const mockComplaints = [
      {
        id: 'c1',
        title: 'Nearby Incident (300m)',
        location: { latitude: 28.6166, longitude: 77.2090 } // ~300m
      },
      {
        id: 'c2',
        title: 'Medium Distance (2.5km)',
        location: { latitude: 28.6364, longitude: 77.2090 } // ~2.5km
      },
      {
        id: 'c3',
        title: 'Far Incident (15km)',
        location: { latitude: 28.7490, longitude: 77.2090 } // ~15km
      }
    ];

    it('should only return complaints within the authorized radius and sort closest first', () => {
      const radius5km = filterComplaintsByRadius(mockComplaints, center.lat, center.lng, 5);
      assert.strictEqual(radius5km.length, 2);
      assert.strictEqual(radius5km[0].id, 'c1');
      assert.strictEqual(radius5km[1].id, 'c2');
      assert.ok(radius5km[0].distanceKm < radius5km[1].distanceKm);
      assert.ok(radius5km[0].distanceFormatted.includes('away'));
    });

    it('should exclude incidents outside a smaller 1 km radius', () => {
      const radius1km = filterComplaintsByRadius(mockComplaints, center.lat, center.lng, 1);
      assert.strictEqual(radius1km.length, 1);
      assert.strictEqual(radius1km[0].id, 'c1');
    });
  });
});
