import mongoose from 'mongoose';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES
} from '../models/Complaint.js';

/**
 * Validates MongoDB ObjectId string representation.
 * @param {string} id
 * @returns {boolean}
 */
export const isValidObjectId = (id) => {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id) && mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validates payload for creating a new complaint.
 * @param {object} payload
 * @returns {{ isValid: boolean, errors: Array<{ field: string, issue: string }> }}
 */
export const validateCreateComplaint = (payload = {}) => {
  const errors = [];
  const { title, description, category, priority, location } = payload;

  // Title
  if (!title || typeof title !== 'string' || title.trim().length < 5) {
    errors.push({ field: 'title', issue: 'Title must be at least 5 characters long.' });
  } else if (title.trim().length > 120) {
    errors.push({ field: 'title', issue: 'Title cannot exceed 120 characters.' });
  }

  // Description
  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    errors.push({ field: 'description', issue: 'Description must be at least 10 characters long.' });
  } else if (description.trim().length > 2000) {
    errors.push({ field: 'description', issue: 'Description cannot exceed 2000 characters.' });
  }

  // Category
  const normalizedCategory = typeof category === 'string' ? category.trim().toLowerCase() : '';
  if (!normalizedCategory || !COMPLAINT_CATEGORIES.includes(normalizedCategory)) {
    errors.push({
      field: 'category',
      issue: `Category must be one of: ${COMPLAINT_CATEGORIES.join(', ')}.`
    });
  }

  // Priority (optional on create, defaults to medium)
  if (priority !== undefined) {
    const normalizedPriority = typeof priority === 'string' ? priority.trim().toLowerCase() : '';
    if (!COMPLAINT_PRIORITIES.includes(normalizedPriority)) {
      errors.push({
        field: 'priority',
        issue: `Priority must be one of: ${COMPLAINT_PRIORITIES.join(', ')}.`
      });
    }
  }

  // Location
  if (!location || typeof location !== 'object') {
    errors.push({ field: 'location', issue: 'Location object (building, floor, room) is required.' });
  } else {
    if (!location.building || typeof location.building !== 'string' || !location.building.trim()) {
      errors.push({ field: 'location.building', issue: 'Building designation is required.' });
    }
    if (!location.floor || typeof location.floor !== 'string' || !location.floor.trim()) {
      errors.push({ field: 'location.floor', issue: 'Floor designation is required.' });
    }
    const roomVal = location.room || location.roomOrUnit;
    if (!roomVal || typeof roomVal !== 'string' || !roomVal.trim()) {
      errors.push({ field: 'location.room', issue: 'Room or unit designation is required.' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates payload for updating complaint fields.
 * @param {object} payload
 * @param {string} userRole
 * @param {string} currentStatus
 * @returns {{ isValid: boolean, errors: Array<{ field: string, issue: string }>, allowedUpdates: object }}
 */
export const validateUpdateComplaint = (payload = {}, userRole, currentStatus) => {
  const errors = [];
  const allowedUpdates = {};

  // Disallowed sensitive fields on general PATCH
  const protectedFields = ['complaintNumber', 'createdBy', 'assignedTo', 'status', '_id', 'createdAt', 'updatedAt'];
  for (const field of protectedFields) {
    if (payload[field] !== undefined) {
      errors.push({ field, issue: `Field "${field}" cannot be modified via general update.` });
    }
  }

  // Normal users can only edit their own complaints if still in 'submitted' status
  if (userRole === 'user' && currentStatus !== 'submitted') {
    errors.push({
      field: 'status',
      issue: 'Complaints can only be edited while in "submitted" status. Contact an administrator for modifications.'
    });
    return { isValid: false, errors, allowedUpdates };
  }

  // Title
  if (payload.title !== undefined) {
    if (typeof payload.title !== 'string' || payload.title.trim().length < 5 || payload.title.trim().length > 120) {
      errors.push({ field: 'title', issue: 'Title must be between 5 and 120 characters long.' });
    } else {
      allowedUpdates.title = payload.title.trim();
    }
  }

  // Description
  if (payload.description !== undefined) {
    if (typeof payload.description !== 'string' || payload.description.trim().length < 10 || payload.description.trim().length > 2000) {
      errors.push({ field: 'description', issue: 'Description must be between 10 and 2000 characters long.' });
    } else {
      allowedUpdates.description = payload.description.trim();
    }
  }

  // Category (Admin only or user in submitted state)
  if (payload.category !== undefined) {
    const normCategory = typeof payload.category === 'string' ? payload.category.trim().toLowerCase() : '';
    if (!COMPLAINT_CATEGORIES.includes(normCategory)) {
      errors.push({ field: 'category', issue: `Category must be one of: ${COMPLAINT_CATEGORIES.join(', ')}.` });
    } else {
      allowedUpdates.category = normCategory;
    }
  }

  // Priority (Admin only or user in submitted state)
  if (payload.priority !== undefined) {
    const normPriority = typeof payload.priority === 'string' ? payload.priority.trim().toLowerCase() : '';
    if (!COMPLAINT_PRIORITIES.includes(normPriority)) {
      errors.push({ field: 'priority', issue: `Priority must be one of: ${COMPLAINT_PRIORITIES.join(', ')}.` });
    } else {
      allowedUpdates.priority = normPriority;
    }
  }

  // Location
  if (payload.location !== undefined) {
    if (typeof payload.location !== 'object' || payload.location === null) {
      errors.push({ field: 'location', issue: 'Location must be an object containing building, floor, room.' });
    } else {
      allowedUpdates.location = {};
      if (payload.location.building) allowedUpdates.location.building = payload.location.building.trim();
      if (payload.location.floor) allowedUpdates.location.floor = payload.location.floor.trim();
      if (payload.location.room) allowedUpdates.location.room = payload.location.room.trim();
      if (payload.location.description !== undefined) allowedUpdates.location.description = payload.location.description.trim();
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    allowedUpdates
  };
};

/**
 * Validates status transitions according to the defined business workflow rules.
 * @param {object} params
 * @returns {{ isValid: boolean, error?: string, actionType?: string }}
 */
export const validateStatusTransition = ({
  currentStatus,
  targetStatus,
  userRole,
  isCreator = false,
  isAssignedTechnician = false,
  note = ''
}) => {
  if (!targetStatus || !COMPLAINT_STATUSES.includes(targetStatus)) {
    return {
      isValid: false,
      error: `Invalid target status "${targetStatus}". Allowed: ${COMPLAINT_STATUSES.join(', ')}.`
    };
  }

  if (currentStatus === targetStatus) {
    return {
      isValid: false,
      error: `Complaint is already in "${currentStatus}" status.`
    };
  }

  // Terminal state check
  if (currentStatus === 'rejected') {
    return {
      isValid: false,
      error: 'Cannot transition from "rejected" state. Rejected complaints are permanently closed.'
    };
  }

  // Define transition matrix with required roles and validation rules
  switch (currentStatus) {
    case 'submitted':
      if (targetStatus === 'assigned') {
        if (userRole !== 'admin') {
          return { isValid: false, error: 'Only administrators can assign technicians to submitted complaints.' };
        }
        return { isValid: true, actionType: 'STATUS_CHANGED' };
      }
      if (targetStatus === 'rejected') {
        if (userRole !== 'admin') {
          return { isValid: false, error: 'Only administrators can reject complaints.' };
        }
        if (!note || note.trim().length < 5) {
          return { isValid: false, error: 'A rejection reason (note) of at least 5 characters is required.' };
        }
        return { isValid: true, actionType: 'STATUS_CHANGED' };
      }
      return {
        isValid: false,
        error: `Cannot transition directly from "submitted" to "${targetStatus}". Ticket must first be assigned or rejected by an administrator.`
      };

    case 'assigned':
      if (targetStatus === 'in_progress') {
        if (!isAssignedTechnician && userRole !== 'admin') {
          return { isValid: false, error: 'Only the assigned technician or an administrator can mark a job in progress.' };
        }
        return { isValid: true, actionType: 'STATUS_CHANGED' };
      }
      if (targetStatus === 'rejected') {
        if (userRole !== 'admin') {
          return { isValid: false, error: 'Only administrators can reject an assigned complaint.' };
        }
        if (!note || note.trim().length < 5) {
          return { isValid: false, error: 'A rejection reason (note) of at least 5 characters is required.' };
        }
        return { isValid: true, actionType: 'STATUS_CHANGED' };
      }
      return {
        isValid: false,
        error: `Cannot transition from "assigned" to "${targetStatus}". Expected: "in_progress" or "rejected".`
      };

    case 'in_progress':
      if (targetStatus === 'on_hold') {
        if (!isAssignedTechnician && userRole !== 'admin') {
          return { isValid: false, error: 'Only the assigned technician or an administrator can put work on hold.' };
        }
        if (!note || note.trim().length < 5) {
          return { isValid: false, error: 'A reason note explaining why work is on hold is required (minimum 5 characters).' };
        }
        return { isValid: true, actionType: 'STATUS_CHANGED' };
      }
      if (targetStatus === 'resolved') {
        if (!isAssignedTechnician && userRole !== 'admin') {
          return { isValid: false, error: 'Only the assigned technician or an administrator can mark work as resolved.' };
        }
        if (!note || note.trim().length < 5) {
          return { isValid: false, error: 'A resolution note detailing repair actions is required (minimum 5 characters).' };
        }
        return { isValid: true, actionType: 'RESOLVED' };
      }
      return {
        isValid: false,
        error: `Cannot transition from "in_progress" to "${targetStatus}". Expected: "on_hold" or "resolved".`
      };

    case 'on_hold':
      if (targetStatus === 'in_progress') {
        if (!isAssignedTechnician && userRole !== 'admin') {
          return { isValid: false, error: 'Only the assigned technician or an administrator can resume work from on-hold.' };
        }
        return { isValid: true, actionType: 'STATUS_CHANGED' };
      }
      return {
        isValid: false,
        error: `Cannot transition from "on_hold" to "${targetStatus}". Expected: "in_progress".`
      };

    case 'resolved':
      if (targetStatus === 'closed') {
        if (!isCreator && userRole !== 'admin') {
          return { isValid: false, error: 'Only the complaint creator or an administrator can confirm resolution and close the ticket.' };
        }
        return { isValid: true, actionType: 'CLOSED' };
      }
      if (targetStatus === 'in_progress') {
        // Reopen ticket
        if (!isCreator && userRole !== 'admin') {
          return { isValid: false, error: 'Only the complaint creator or an administrator can reopen an unsatisfied resolution.' };
        }
        if (!note || note.trim().length < 5) {
          return { isValid: false, error: 'A note explaining why the resolution was unsatisfactory is required to reopen (minimum 5 characters).' };
        }
        return { isValid: true, actionType: 'REOPENED' };
      }
      return {
        isValid: false,
        error: `Cannot transition from "resolved" to "${targetStatus}". Expected: "closed" or "in_progress" (reopen).`
      };

    case 'closed':
      if (targetStatus === 'in_progress') {
        if (userRole !== 'admin') {
          return { isValid: false, error: 'Only administrators can reopen a closed ticket.' };
        }
        if (!note || note.trim().length < 5) {
          return { isValid: false, error: 'An administrative note is required to reopen a closed ticket.' };
        }
        return { isValid: true, actionType: 'REOPENED' };
      }
      return {
        isValid: false,
        error: 'Closed tickets cannot transition to other states. Reopening requires administrative action.'
      };

    default:
      return { isValid: false, error: `Unhandled transition from "${currentStatus}".` };
  }
};

/**
 * Validates query pagination and filter parameters.
 * @param {object} query
 * @returns {{ page: number, limit: number, filters: object, errors: string[] }}
 */
export const validatePaginationParams = (query = {}) => {
  const errors = [];
  const filters = {};

  // Page
  let page = 1;
  if (query.page !== undefined) {
    const parsedPage = parseInt(query.page, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      errors.push('Page parameter must be a positive integer >= 1.');
    } else {
      page = parsedPage;
    }
  }

  // Limit (Bounded: default 10, maximum 50)
  let limit = 10;
  if (query.limit !== undefined) {
    const parsedLimit = parseInt(query.limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      errors.push('Limit parameter must be a positive integer >= 1.');
    } else if (parsedLimit > 50) {
      errors.push('Limit parameter cannot exceed maximum of 50.');
    } else {
      limit = parsedLimit;
    }
  }

  // Filter: status
  if (query.status !== undefined && query.status !== '') {
    const normStatus = query.status.trim().toLowerCase();
    if (!COMPLAINT_STATUSES.includes(normStatus)) {
      errors.push(`Invalid status filter "${query.status}". Allowed: ${COMPLAINT_STATUSES.join(', ')}.`);
    } else {
      filters.status = normStatus;
    }
  }

  // Filter: category
  if (query.category !== undefined && query.category !== '') {
    const normCategory = query.category.trim().toLowerCase();
    if (!COMPLAINT_CATEGORIES.includes(normCategory)) {
      errors.push(`Invalid category filter "${query.category}". Allowed: ${COMPLAINT_CATEGORIES.join(', ')}.`);
    } else {
      filters.category = normCategory;
    }
  }

  // Filter: priority
  if (query.priority !== undefined && query.priority !== '') {
    const normPriority = query.priority.trim().toLowerCase();
    if (!COMPLAINT_PRIORITIES.includes(normPriority)) {
      errors.push(`Invalid priority filter "${query.priority}". Allowed: ${COMPLAINT_PRIORITIES.join(', ')}.`);
    } else {
      filters.priority = normPriority;
    }
  }

  return {
    page,
    limit,
    filters,
    errors
  };
};

/**
 * Validates payload for submitting feedback and ratings on eligible complaints.
 * @param {object} payload
 * @returns {{ isValid: boolean, errors: Array<{ field: string, issue: string }>, sanitized: { rating: number, comments: string } }}
 */
export const validateFeedbackInput = (payload = {}) => {
  const errors = [];
  const sanitized = { rating: null, comments: '' };

  const { rating, comments } = payload;

  if (rating === undefined || rating === null) {
    errors.push({ field: 'rating', issue: 'Rating is required.' });
  } else {
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      errors.push({ field: 'rating', issue: 'Rating must be an integer between 1 and 5.' });
    } else {
      sanitized.rating = numRating;
    }
  }

  if (comments !== undefined && comments !== null) {
    if (typeof comments !== 'string') {
      errors.push({ field: 'comments', issue: 'Comments must be a string.' });
    } else if (comments.trim().length > 500) {
      errors.push({ field: 'comments', issue: 'Comments cannot exceed 500 characters.' });
    } else {
      sanitized.comments = comments.trim();
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

export default {
  isValidObjectId,
  validateCreateComplaint,
  validateUpdateComplaint,
  validateStatusTransition,
  validatePaginationParams,
  validateFeedbackInput
};

