import { Complaint } from '../models/Complaint.js';
import { ComplaintHistory } from '../models/ComplaintHistory.js';
import { User } from '../models/User.js';
import { TechnicianProfile } from '../models/TechnicianProfile.js';
import { getNextComplaintNumber } from '../models/Counter.js';
import { AppError } from '../utils/AppError.js';
import { filterComplaintsByRadius } from '../utils/geo.js';
import {
  isValidObjectId,
  validateCreateComplaint,
  validateUpdateComplaint,
  validateStatusTransition,
  validatePaginationParams,
  validateFeedbackInput
} from '../utils/complaintValidation.js';

const extractId = (val) => {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (val.id) return String(val.id);
  if (val._id) return String(val._id);
  return String(val);
};

/**
 * @route   POST /api/v1/complaints
 * @desc    Log a new maintenance complaint
 * @access  Authenticated (User, Admin)
 */
export const createComplaint = async (req, res, next) => {
  try {
    const validation = validateCreateComplaint(req.body);
    if (!validation.isValid) {
      return next(
        new AppError('Validation failed on complaint creation.', 400, 'VALIDATION_ERROR', validation.errors)
      );
    }

    // Atomic collision-safe complaint number generation
    const complaintNumber = await getNextComplaintNumber();

    const { title, description, category, priority, location } = req.body;

    // Resolve real geo-coordinates (use provided coordinates or realistic campus building coordinates)
    let latitude = null;
    let longitude = null;
    if (typeof location.latitude === 'number' && !isNaN(location.latitude)) {
      latitude = location.latitude;
    } else if (location.latitude && !isNaN(parseFloat(location.latitude))) {
      latitude = parseFloat(location.latitude);
    }

    if (typeof location.longitude === 'number' && !isNaN(location.longitude)) {
      longitude = location.longitude;
    } else if (location.longitude && !isNaN(parseFloat(location.longitude))) {
      longitude = parseFloat(location.longitude);
    }

    // Default facility anchor (e.g. facility campus) if coordinates not passed
    if (latitude === null || longitude === null) {
      const baseLat = 28.6139;
      const baseLng = 77.2090;
      const seed = `${location.building || 'Campus'}-${location.room || location.roomOrUnit || '101'}`;
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
      }
      const offsetLat = ((Math.abs(hash) % 80) - 40) * 0.00015;
      const offsetLng = (((Math.abs(hash) >> 3) % 80) - 40) * 0.00015;
      latitude = parseFloat((baseLat + offsetLat).toFixed(6));
      longitude = parseFloat((baseLng + offsetLng).toFixed(6));
    }

    const newComplaint = await Complaint.create({
      complaintNumber,
      title: title.trim(),
      description: description.trim(),
      category: category.trim().toLowerCase(),
      priority: priority ? priority.trim().toLowerCase() : 'medium',
      status: 'submitted',
      location: {
        building: location.building.trim(),
        floor: location.floor.trim(),
        room: (location.room || location.roomOrUnit).trim(),
        description: (location.description || location.additionalNotes || '').trim(),
        latitude,
        longitude,
        address: (location.address || '').trim()
      },
      createdBy: req.user.id,
      assignedTo: null
    });

    // Record initial immutable history log
    await ComplaintHistory.logEvent({
      complaintId: newComplaint._id,
      actorId: req.user.id,
      action: 'CREATED',
      newState: {
        status: newComplaint.status,
        priority: newComplaint.priority,
        complaintNumber: newComplaint.complaintNumber
      },
      note: 'Complaint submitted by requester.'
    });

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully.',
      data: {
        complaint: newComplaint.toSafeObject ? newComplaint.toSafeObject() : newComplaint
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/v1/complaints
 * @desc    List complaints scoped to caller role with bounded pagination and filtering
 * @access  Authenticated (Role-scoped)
 */
export const getComplaints = async (req, res, next) => {
  try {
    const { page, limit, filters, geo, errors } = validatePaginationParams(req.query);
    if (errors.length > 0) {
      return next(new AppError('Invalid query parameters.', 400, 'INVALID_QUERY_PARAMS', errors));
    }

    const query = { ...filters };
    const isNearbyQuery = req.query.nearby === 'true' || req.query.scope === 'nearby';

    // Maximum permitted radius based on role (prevent bypass):
    // Standard users: max 10 km (default 5 km)
    // Technicians: max 25 km
    // Admins: up to 50 km
    let effectiveRadius = geo ? geo.radius : 5;
    if (req.user.role === 'user' && effectiveRadius > 10) {
      effectiveRadius = 10;
    } else if (req.user.role === 'technician' && effectiveRadius > 25) {
      effectiveRadius = 25;
    }

    // Role-based scoping:
    // If nearby query is active:
    // - User can view nearby facility complaints within their authorized radius
    // - Technician can view nearby complaints within radius
    // - Admin can view all organizational complaints
    // If standard query (not nearby):
    // - User only views their created complaints
    // - Technician only views their assigned complaints
    // - Admin views all complaints
    if (!isNearbyQuery) {
      if (req.user.role === 'user') {
        query.createdBy = req.user.id;
      } else if (req.user.role === 'technician') {
        query.assignedTo = req.user.id;
      }
    }

    // When geo parameters are provided, perform Haversine distance calculation and boundary enforcement
    if (geo) {
      const allCandidates = await Complaint.find(query)
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name email role')
        .populate('assignedTo', 'name email role');

      const nearbyComplaints = filterComplaintsByRadius(
        allCandidates,
        geo.lat,
        geo.lng,
        effectiveRadius
      );

      const totalNearby = nearbyComplaints.length;
      const skip = (page - 1) * limit;
      const paginated = nearbyComplaints.slice(skip, skip + limit);
      const totalPages = Math.ceil(totalNearby / limit) || 1;

      return res.status(200).json({
        success: true,
        data: {
          complaints: paginated.map((c) => (c.toSafeObject ? c.toSafeObject() : c))
        },
        meta: {
          page,
          limit,
          totalCount: totalNearby,
          totalPages,
          nearby: {
            active: true,
            center: { latitude: geo.lat, longitude: geo.lng },
            radiusKm: effectiveRadius,
            totalWithinRadius: totalNearby
          }
        }
      });
    }

    const skip = (page - 1) * limit;

    const [complaints, totalCount] = await Promise.all([
      Complaint.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email role')
        .populate('assignedTo', 'name email role'),
      Complaint.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    return res.status(200).json({
      success: true,
      data: {
        complaints: complaints.map((c) => (c.toSafeObject ? c.toSafeObject() : c))
      },
      meta: {
        page,
        limit,
        totalCount,
        totalPages
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/v1/complaints/:id
 * @desc    Retrieve single complaint if authorized
 * @access  Authenticated (Creator, Assigned Technician, or Admin)
 */
export const getComplaintById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return next(new AppError('Invalid complaint ID format.', 400, 'INVALID_IDENTIFIER'));
    }

    const complaint = await Complaint.findById(id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role');

    if (!complaint) {
      return next(new AppError('Complaint not found.', 404, 'COMPLAINT_NOT_FOUND'));
    }

    // Role-based authorization check
    const creatorId = extractId(complaint.createdBy);
    const assignedId = extractId(complaint.assignedTo);

    const isCreator = creatorId === req.user.id;
    const isAssigned = assignedId === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isCreator && !isAssigned && !isAdmin) {
      return next(
        new AppError('Forbidden: you do not have permission to view this complaint.', 403, 'FORBIDDEN')
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        complaint: complaint.toSafeObject ? complaint.toSafeObject() : complaint
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PATCH /api/v1/complaints/:id
 * @desc    Update permitted complaint fields
 * @access  Authenticated (Creator if submitted, or Admin)
 */
export const updateComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return next(new AppError('Invalid complaint ID format.', 400, 'INVALID_IDENTIFIER'));
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return next(new AppError('Complaint not found.', 404, 'COMPLAINT_NOT_FOUND'));
    }

    const creatorId = extractId(complaint.createdBy);
    const isCreator = creatorId === req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Technicians cannot perform general PATCH edits
    if (req.user.role === 'technician') {
      return next(
        new AppError('Technicians must update work orders via the status endpoint.', 403, 'FORBIDDEN')
      );
    }

    if (!isCreator && !isAdmin) {
      return next(
        new AppError('Forbidden: you do not have permission to edit this complaint.', 403, 'FORBIDDEN')
      );
    }

    const validation = validateUpdateComplaint(req.body, req.user.role, complaint.status);
    if (!validation.isValid) {
      return next(
        new AppError('Validation failed on complaint update.', 400, 'VALIDATION_ERROR', validation.errors)
      );
    }

    const previousState = {
      title: complaint.title,
      description: complaint.description,
      priority: complaint.priority,
      category: complaint.category,
      location: complaint.location
    };

    // Apply allowed updates
    Object.assign(complaint, validation.allowedUpdates);
    await complaint.save();

    // Log history event
    const priorityChanged = validation.allowedUpdates.priority && validation.allowedUpdates.priority !== previousState.priority;
    await ComplaintHistory.logEvent({
      complaintId: complaint._id,
      actorId: req.user.id,
      action: priorityChanged ? 'PRIORITY_CHANGED' : 'DETAILS_UPDATED',
      previousState,
      newState: validation.allowedUpdates,
      note: req.body.note || 'Complaint details updated.'
    });

    return res.status(200).json({
      success: true,
      message: 'Complaint updated successfully.',
      data: {
        complaint: complaint.toSafeObject ? complaint.toSafeObject() : complaint
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/v1/complaints/:id/assign
 * @desc    Administrator assigns a technician to a complaint
 * @access  Authenticated (Admin only)
 */
export const assignTechnician = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { technicianId, note } = req.body;

    if (!isValidObjectId(id)) {
      return next(new AppError('Invalid complaint ID format.', 400, 'INVALID_IDENTIFIER'));
    }

    if (!technicianId || !isValidObjectId(technicianId)) {
      return next(new AppError('A valid technicianId is required.', 400, 'INVALID_IDENTIFIER'));
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return next(new AppError('Complaint not found.', 404, 'COMPLAINT_NOT_FOUND'));
    }

    // Verify technician existence, active status, and role
    const technician = await User.findById(technicianId);
    if (!technician || technician.role !== 'technician' || !technician.isActive) {
      return next(
        new AppError(
          'Target user does not exist, is deactivated, or does not possess the "technician" role.',
          400,
          'INVALID_TECHNICIAN'
        )
      );
    }

    // Verify technician specialization approval and availability
    if (technician.technicianProfile) {
      if (technician.technicianProfile.approvalStatus !== 'approved' && !req.body.forceOverride) {
        return next(
          new AppError(
            `Technician ${technician.name} is not approved for work orders (Approval Status: "${technician.technicianProfile.approvalStatus}").`,
            400,
            'TECHNICIAN_NOT_APPROVED'
          )
        );
      }
      if (technician.technicianProfile.isAvailable === false && !req.body.forceOverride) {
        return next(
          new AppError(
            `Technician ${technician.name} is currently marked as unavailable/offline.`,
            400,
            'TECHNICIAN_UNAVAILABLE'
          )
        );
      }
    }

    const previousAssigned = extractId(complaint.assignedTo);
    const previousStatus = complaint.status;

    complaint.assignedTo = technician._id;
    complaint.assignedAt = new Date();

    // If still in 'submitted' state, transition to 'assigned'
    if (complaint.status === 'submitted') {
      complaint.status = 'assigned';
    }

    await complaint.save();

    // Record assignment event in history
    await ComplaintHistory.logEvent({
      complaintId: complaint._id,
      actorId: req.user.id,
      action: 'ASSIGNMENT_CHANGED',
      previousState: { assignedTo: previousAssigned, status: previousStatus },
      newState: { assignedTo: technician._id.toString(), status: complaint.status },
      note: note ? note.trim() : `Assigned to technician ${technician.name}.`
    });

    return res.status(200).json({
      success: true,
      message: `Complaint successfully assigned to technician ${technician.name}.`,
      data: {
        complaint: complaint.toSafeObject ? complaint.toSafeObject() : complaint
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/v1/complaints/:id/matching-technicians
 * @desc    Get matching eligible technicians for a specific complaint
 * @access  Authenticated
 */
export const getMatchingTechniciansForComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return next(new AppError('Invalid complaint ID format.', 400, 'INVALID_IDENTIFIER'));
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return next(new AppError('Complaint not found.', 404, 'COMPLAINT_NOT_FOUND'));
    }

    const technicians = await TechnicianProfile.findMatchingTechnicians({
      category: complaint.category,
      coordinates: complaint.latitude && complaint.longitude ? {
        latitude: complaint.latitude,
        longitude: complaint.longitude
      } : null
    });

    return res.status(200).json({
      success: true,
      data: {
        complaintId: complaint._id,
        category: complaint.category,
        count: technicians.length,
        technicians
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/v1/complaints/:id/status
 * @desc    Update complaint status using validated business workflow rules
 * @access  Authenticated (Authorized role/relationship per transition matrix)
 */
export const updateComplaintStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status: targetStatus, note } = req.body;

    if (!isValidObjectId(id)) {
      return next(new AppError('Invalid complaint ID format.', 400, 'INVALID_IDENTIFIER'));
    }

    if (!targetStatus) {
      return next(new AppError('Target status is required.', 400, 'VALIDATION_ERROR'));
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return next(new AppError('Complaint not found.', 404, 'COMPLAINT_NOT_FOUND'));
    }

    const creatorId = extractId(complaint.createdBy);
    const assignedId = extractId(complaint.assignedTo);

    const isCreator = creatorId === req.user.id;
    const isAssignedTechnician = assignedId === req.user.id;

    // Validate workflow transition rules against current status and actor credentials
    const transition = validateStatusTransition({
      currentStatus: complaint.status,
      targetStatus: targetStatus.trim().toLowerCase(),
      userRole: req.user.role,
      isCreator,
      isAssignedTechnician,
      note
    });

    if (!transition.isValid) {
      return next(new AppError(transition.error, 400, 'INVALID_STATUS_TRANSITION'));
    }

    const previousStatus = complaint.status;
    complaint.status = targetStatus.trim().toLowerCase();

    // Handle resolution details
    if (complaint.status === 'resolved') {
      complaint.resolvedAt = new Date();
      complaint.resolutionNotes = note ? note.trim() : '';
    } else if (complaint.status === 'closed') {
      complaint.closedAt = new Date();
    } else if (complaint.status === 'in_progress' && previousStatus === 'resolved') {
      // Reopen resets resolvedAt
      complaint.resolvedAt = null;
    }

    await complaint.save();

    // Record immutable history log
    await ComplaintHistory.logEvent({
      complaintId: complaint._id,
      actorId: req.user.id,
      action: transition.actionType || 'STATUS_CHANGED',
      previousState: { status: previousStatus },
      newState: { status: complaint.status },
      note: note ? note.trim() : ''
    });

    return res.status(200).json({
      success: true,
      message: `Complaint status updated to "${complaint.status}".`,
      data: {
        complaint: complaint.toSafeObject ? complaint.toSafeObject() : complaint
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/v1/complaints/:id/history
 * @desc    Retrieve chronological activity audit log for a complaint
 * @access  Authenticated (Creator, Assigned Technician, or Admin)
 */
export const getComplaintHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return next(new AppError('Invalid complaint ID format.', 400, 'INVALID_IDENTIFIER'));
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return next(new AppError('Complaint not found.', 404, 'COMPLAINT_NOT_FOUND'));
    }

    const creatorId = extractId(complaint.createdBy);
    const assignedId = extractId(complaint.assignedTo);

    const isCreator = creatorId === req.user.id;
    const isAssigned = assignedId === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isCreator && !isAssigned && !isAdmin) {
      return next(
        new AppError('Forbidden: you do not have permission to view this complaint history.', 403, 'FORBIDDEN')
      );
    }

    const history = await ComplaintHistory.find({ complaintId: id })
      .sort({ timestamp: 1 })
      .populate('actor', 'name email role');

    return res.status(200).json({
      success: true,
      data: {
        complaintId: id,
        history
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/v1/complaints/:id/feedback
 * @desc    Submit rating and feedback on a resolved or closed complaint
 * @access  Authenticated (Creator only)
 */
export const submitFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return next(new AppError('Invalid complaint ID format.', 400, 'INVALID_IDENTIFIER'));
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return next(new AppError('Complaint not found.', 404, 'COMPLAINT_NOT_FOUND'));
    }

    // Only the complaint creator can submit feedback
    const creatorId = extractId(complaint.createdBy);
    if (creatorId !== req.user.id) {
      return next(
        new AppError('Forbidden: only the ticket creator can submit feedback.', 403, 'FORBIDDEN')
      );
    }

    // Must be in resolved or closed status
    if (!['resolved', 'closed'].includes(complaint.status)) {
      return next(
        new AppError(
          `Feedback can only be provided for resolved or closed complaints. Current status: "${complaint.status}".`,
          400,
          'INVALID_STATUS_FOR_FEEDBACK'
        )
      );
    }

    // Enforce one feedback submission per complaint
    if (complaint.feedback && complaint.feedback.rating) {
      return next(
        new AppError('Feedback has already been submitted for this complaint.', 409, 'FEEDBACK_ALREADY_EXISTS')
      );
    }

    const validation = validateFeedbackInput(req.body);
    if (!validation.isValid) {
      return next(
        new AppError('Validation failed on feedback submission.', 400, 'VALIDATION_ERROR', validation.errors)
      );
    }

    complaint.feedback = {
      rating: validation.sanitized.rating,
      comments: validation.sanitized.comments,
      submittedAt: new Date()
    };

    await complaint.save();

    // Log feedback submission in audit trail
    await ComplaintHistory.logEvent({
      complaintId: complaint._id,
      actorId: req.user.id,
      action: 'FEEDBACK_SUBMITTED',
      previousState: null,
      newState: { feedback: complaint.feedback },
      note: `Rated ${validation.sanitized.rating}/5 stars.${validation.sanitized.comments ? ` Review: "${validation.sanitized.comments}"` : ''}`
    });

    return res.status(200).json({
      success: true,
      message: 'Feedback submitted successfully.',
      data: {
        complaint: complaint.toSafeObject ? complaint.toSafeObject() : complaint
      }
    });
  } catch (err) {
    next(err);
  }
};

export default {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaint,
  assignTechnician,
  updateComplaintStatus,
  getComplaintHistory,
  submitFeedback,
  getMatchingTechniciansForComplaint
};
