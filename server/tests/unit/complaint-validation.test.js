import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidObjectId,
  isValidId,
  validateCreateComplaint,
  validateUpdateComplaint,
  validateStatusTransition,
  validatePaginationParams,
  validateFeedbackInput
} from '../../src/utils/complaintValidation.js';

describe('Complaint Validation Unit Tests', () => {
  describe('isValidObjectId', () => {
    it('should accept valid 24-character hexadecimal MongoDB ObjectIds', () => {
      assert.strictEqual(isValidObjectId('651a7b8e4f1c9a0012345678'), true);
      assert.strictEqual(isValidObjectId('000000000000000000000000'), true);
    });

    it('should accept valid canonical UUID format used by Prisma schema', () => {
      assert.strictEqual(isValidObjectId('123e4567-e89b-12d3-a456-426614174000'), true);
      assert.strictEqual(isValidObjectId('c0a80101-0000-0000-0000-000000000000'), true);
      assert.strictEqual(isValidId('123e4567-e89b-12d3-a456-426614174000'), true);
    });

    it('should accept valid CUID format', () => {
      assert.strictEqual(isValidObjectId('cjy01abcde012345678901234'), true);
    });

    it('should reject invalid or malformed IDs', () => {
      assert.strictEqual(isValidObjectId('12345'), false);
      assert.strictEqual(isValidObjectId('not-a-valid-id-1234567890'), false);
      assert.strictEqual(isValidObjectId(null), false);
      assert.strictEqual(isValidObjectId(undefined), false);
      assert.strictEqual(isValidObjectId(''), false);
      assert.strictEqual(isValidObjectId('   '), false);
      assert.strictEqual(isValidObjectId(12345), false);
      assert.strictEqual(isValidObjectId({}), false);
    });
  });

  describe('validateCreateComplaint', () => {
    const validPayload = {
      title: 'Water leaking under kitchen sink',
      description: 'Pipe joint has failed and water is dripping steadily onto the cabinet floor.',
      category: 'plumbing',
      priority: 'high',
      location: {
        building: 'Building A',
        floor: '2',
        room: '204'
      }
    };

    it('should accept valid, complete complaint payloads', () => {
      const result = validateCreateComplaint(validPayload);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should reject titles shorter than 5 characters or longer than 120 characters', () => {
      const tooShort = validateCreateComplaint({ ...validPayload, title: 'Fix' });
      assert.strictEqual(tooShort.isValid, false);
      assert.ok(tooShort.errors.some((e) => e.field === 'title'));

      const tooLong = validateCreateComplaint({ ...validPayload, title: 'A'.repeat(125) });
      assert.strictEqual(tooLong.isValid, false);
      assert.ok(tooLong.errors.some((e) => e.field === 'title'));
    });

    it('should reject descriptions shorter than 10 characters', () => {
      const result = validateCreateComplaint({ ...validPayload, description: 'Broken' });
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some((e) => e.field === 'description'));
    });

    it('should reject invalid categories', () => {
      const result = validateCreateComplaint({ ...validPayload, category: 'spaceship_propulsion' });
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some((e) => e.field === 'category'));
    });

    it('should reject missing location components', () => {
      const noBuilding = validateCreateComplaint({
        ...validPayload,
        location: { floor: '1', room: '101' }
      });
      assert.strictEqual(noBuilding.isValid, false);
      assert.ok(noBuilding.errors.some((e) => e.field === 'location.building'));

      const noFloor = validateCreateComplaint({
        ...validPayload,
        location: { building: 'Tower B', room: '101' }
      });
      assert.strictEqual(noFloor.isValid, false);
      assert.ok(noFloor.errors.some((e) => e.field === 'location.floor'));

      const noRoom = validateCreateComplaint({
        ...validPayload,
        location: { building: 'Tower B', floor: '1' }
      });
      assert.strictEqual(noRoom.isValid, false);
      assert.ok(noRoom.errors.some((e) => e.field === 'location.room'));
    });
  });

  describe('validateUpdateComplaint', () => {
    it('should reject modification of protected workflow fields', () => {
      const result = validateUpdateComplaint(
        { complaintNumber: 'FIX-999999-9999', status: 'closed' },
        'admin',
        'in_progress'
      );
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some((e) => e.field === 'complaintNumber'));
      assert.ok(result.errors.some((e) => e.field === 'status'));
    });

    it('should prevent standard users from editing complaints not in submitted status', () => {
      const result = validateUpdateComplaint(
        { title: 'New Title Here' },
        'user',
        'in_progress'
      );
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors[0].field, 'status');
    });

    it('should allow administrators to update permitted fields', () => {
      const result = validateUpdateComplaint(
        {
          title: 'Updated Emergency Water Leak',
          priority: 'urgent',
          category: 'plumbing'
        },
        'admin',
        'in_progress'
      );
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.allowedUpdates.title, 'Updated Emergency Water Leak');
      assert.strictEqual(result.allowedUpdates.priority, 'urgent');
      assert.strictEqual(result.allowedUpdates.category, 'plumbing');
    });
  });

  describe('validateStatusTransition (State Machine Rules)', () => {
    it('should allow assigned technician to start in_progress work', () => {
      const transition = validateStatusTransition({
        currentStatus: 'assigned',
        targetStatus: 'in_progress',
        userRole: 'technician',
        isAssignedTechnician: true
      });
      assert.strictEqual(transition.isValid, true);
    });

    it('should reject unassigned technician from moving job to in_progress', () => {
      const transition = validateStatusTransition({
        currentStatus: 'assigned',
        targetStatus: 'in_progress',
        userRole: 'technician',
        isAssignedTechnician: false
      });
      assert.strictEqual(transition.isValid, false);
      assert.match(transition.error, /Only the assigned technician/);
    });

    it('should require note when resolving work', () => {
      const withoutNote = validateStatusTransition({
        currentStatus: 'in_progress',
        targetStatus: 'resolved',
        userRole: 'technician',
        isAssignedTechnician: true,
        note: ''
      });
      assert.strictEqual(withoutNote.isValid, false);
      assert.match(withoutNote.error, /resolution note/i);

      const withNote = validateStatusTransition({
        currentStatus: 'in_progress',
        targetStatus: 'resolved',
        userRole: 'technician',
        isAssignedTechnician: true,
        note: 'Replaced compression fitting and verified zero leakage.'
      });
      assert.strictEqual(withNote.isValid, true);
    });

    it('should require note when putting work on hold', () => {
      const withoutNote = validateStatusTransition({
        currentStatus: 'in_progress',
        targetStatus: 'on_hold',
        userRole: 'technician',
        isAssignedTechnician: true,
        note: ''
      });
      assert.strictEqual(withoutNote.isValid, false);

      const withNote = validateStatusTransition({
        currentStatus: 'in_progress',
        targetStatus: 'on_hold',
        userRole: 'technician',
        isAssignedTechnician: true,
        note: 'Waiting for replacement valve delivery.'
      });
      assert.strictEqual(withNote.isValid, true);
    });

    it('should allow creator to close resolved ticket', () => {
      const transition = validateStatusTransition({
        currentStatus: 'resolved',
        targetStatus: 'closed',
        userRole: 'user',
        isCreator: true
      });
      assert.strictEqual(transition.isValid, true);
    });

    it('should allow creator to reopen resolved ticket with explanation note', () => {
      const withoutNote = validateStatusTransition({
        currentStatus: 'resolved',
        targetStatus: 'in_progress',
        userRole: 'user',
        isCreator: true,
        note: ''
      });
      assert.strictEqual(withoutNote.isValid, false);

      const withNote = validateStatusTransition({
        currentStatus: 'resolved',
        targetStatus: 'in_progress',
        userRole: 'user',
        isCreator: true,
        note: 'The sink is still leaking from the hot water side.'
      });
      assert.strictEqual(withNote.isValid, true);
      assert.strictEqual(withNote.actionType, 'REOPENED');
    });

    it('should reject invalid status jumps (e.g., submitted directly to resolved)', () => {
      const transition = validateStatusTransition({
        currentStatus: 'submitted',
        targetStatus: 'resolved',
        userRole: 'technician',
        isAssignedTechnician: false
      });
      assert.strictEqual(transition.isValid, false);
    });

    it('should block transitions from permanently rejected tickets', () => {
      const transition = validateStatusTransition({
        currentStatus: 'rejected',
        targetStatus: 'in_progress',
        userRole: 'admin'
      });
      assert.strictEqual(transition.isValid, false);
      assert.match(transition.error, /permanently closed/);
    });
  });

  describe('validatePaginationParams', () => {
    it('should use default page 1 and limit 10', () => {
      const result = validatePaginationParams({});
      assert.strictEqual(result.page, 1);
      assert.strictEqual(result.limit, 10);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should cap limit at maximum of 50 to prevent unbounded queries', () => {
      const result = validatePaginationParams({ limit: '100' });
      assert.strictEqual(result.errors.length, 1);
      assert.match(result.errors[0], /cannot exceed maximum of 50/);
    });

    it('should validate and extract valid filters', () => {
      const result = validatePaginationParams({
        page: '1',
        limit: '20',
        status: 'submitted',
        priority: 'high',
        category: 'electrical'
      });
      assert.strictEqual(result.page, 1);
      assert.strictEqual(result.limit, 20);
      assert.strictEqual(result.filters.status, 'submitted');
      assert.strictEqual(result.filters.priority, 'high');
      assert.strictEqual(result.filters.category, 'electrical');
      assert.strictEqual(result.errors.length, 0);
    });
  });

  describe('validateFeedbackInput', () => {
    it('should accept valid rating and comments', () => {
      const result = validateFeedbackInput({ rating: 5, comments: 'Technician was quick and clean!' });
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.sanitized.rating, 5);
      assert.strictEqual(result.sanitized.comments, 'Technician was quick and clean!');
    });

    it('should reject missing rating or non-integer ratings', () => {
      const missing = validateFeedbackInput({ comments: 'No rating' });
      assert.strictEqual(missing.isValid, false);
      assert.ok(missing.errors.some((e) => e.field === 'rating'));

      const floatRating = validateFeedbackInput({ rating: 4.5 });
      assert.strictEqual(floatRating.isValid, false);
      assert.ok(floatRating.errors.some((e) => e.field === 'rating'));
    });

    it('should reject ratings outside the 1-5 range', () => {
      const zero = validateFeedbackInput({ rating: 0 });
      assert.strictEqual(zero.isValid, false);

      const six = validateFeedbackInput({ rating: 6 });
      assert.strictEqual(six.isValid, false);
    });

    it('should reject comments exceeding 500 characters', () => {
      const result = validateFeedbackInput({ rating: 3, comments: 'X'.repeat(505) });
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some((e) => e.field === 'comments'));
    });
  });
});
