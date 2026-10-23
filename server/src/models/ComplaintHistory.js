import mongoose from 'mongoose';

export const HISTORY_ACTIONS = [
  'CREATED',
  'ASSIGNMENT_CHANGED',
  'STATUS_CHANGED',
  'PRIORITY_CHANGED',
  'DETAILS_UPDATED',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'FEEDBACK_SUBMITTED'
];

const complaintHistorySchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: [true, 'Complaint reference is required'],
      index: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor user reference is required']
    },
    action: {
      type: String,
      required: [true, 'Action type is required'],
      enum: {
        values: HISTORY_ACTIONS,
        message: 'Invalid history action. Allowed: {VALUES}'
      }
    },
    previousState: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    newState: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    note: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    versionKey: false,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound index for fast chronological activity timeline lookups
complaintHistorySchema.index({ complaintId: 1, timestamp: 1 });

/**
 * Static helper to log an immutable audit event.
 * @param {object} params
 * @returns {Promise<Document>}
 */
complaintHistorySchema.statics.logEvent = async function ({
  complaintId,
  actorId,
  action,
  previousState = null,
  newState = null,
  note = ''
}) {
  return this.create({
    complaintId,
    actor: actorId,
    action,
    previousState,
    newState,
    note
  });
};

export const ComplaintHistory =
  mongoose.models.ComplaintHistory || mongoose.model('ComplaintHistory', complaintHistorySchema);

export default ComplaintHistory;
