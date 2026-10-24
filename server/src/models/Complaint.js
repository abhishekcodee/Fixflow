import mongoose from 'mongoose';

export const COMPLAINT_CATEGORIES = [
  'electrical',
  'plumbing',
  'hvac',
  'carpentry',
  'appliance',
  'safety_security',
  'other'
];

export const COMPLAINT_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export const COMPLAINT_STATUSES = [
  'submitted',
  'assigned',
  'in_progress',
  'on_hold',
  'resolved',
  'closed',
  'rejected'
];

const complaintSchema = new mongoose.Schema(
  {
    complaintNumber: {
      type: String,
      required: [true, 'Complaint number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters long'],
      maxlength: [120, 'Title cannot exceed 120 characters']
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters long'],
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: COMPLAINT_CATEGORIES,
        message: 'Invalid category. Allowed: {VALUES}'
      },
      lowercase: true,
      trim: true
    },
    priority: {
      type: String,
      required: [true, 'Priority is required'],
      enum: {
        values: COMPLAINT_PRIORITIES,
        message: 'Invalid priority. Allowed: {VALUES}'
      },
      default: 'medium',
      lowercase: true,
      trim: true
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: COMPLAINT_STATUSES,
        message: 'Invalid status. Allowed: {VALUES}'
      },
      default: 'submitted',
      lowercase: true,
      trim: true,
      index: true
    },
    location: {
      building: {
        type: String,
        required: [true, 'Building designation is required'],
        trim: true,
        maxlength: 60
      },
      floor: {
        type: String,
        required: [true, 'Floor designation is required'],
        trim: true,
        maxlength: 30
      },
      room: {
        type: String,
        required: [true, 'Room or unit designation is required'],
        trim: true,
        maxlength: 30
      },
      description: {
        type: String,
        trim: true,
        default: '',
        maxlength: 200
      },
      latitude: {
        type: Number,
        default: null
      },
      longitude: {
        type: Number,
        default: null
      },
      address: {
        type: String,
        trim: true,
        default: '',
        maxlength: 250
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator user reference is required'],
      index: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    assignedAt: {
      type: Date,
      default: null
    },
    resolutionNotes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    closedAt: {
      type: Date,
      default: null
    },
    feedback: {
      rating: {
        type: Number,
        min: [1, 'Rating must be between 1 and 5'],
        max: [5, 'Rating must be between 1 and 5'],
        default: null
      },
      comments: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'Comments cannot exceed 500 characters']
      },
      submittedAt: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound indexes for bounded list queries & dashboard filtering
complaintSchema.index({ createdBy: 1, createdAt: -1 });
complaintSchema.index({ assignedTo: 1, status: 1 });
complaintSchema.index({ status: 1, priority: 1, createdAt: -1 });

/**
 * Returns a sanitized plain object representation of the complaint.
 */
complaintSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    complaintNumber: this.complaintNumber,
    title: this.title,
    description: this.description,
    category: this.category,
    priority: this.priority,
    status: this.status,
    location: this.location,
    createdBy: this.createdBy,
    assignedTo: this.assignedTo,
    assignedAt: this.assignedAt,
    resolutionNotes: this.resolutionNotes,
    resolvedAt: this.resolvedAt,
    closedAt: this.closedAt,
    feedback: this.feedback && this.feedback.rating ? this.feedback : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

export const Complaint = mongoose.models.Complaint || mongoose.model('Complaint', complaintSchema);
export default Complaint;
