# 05 — Database Design & Data Models

## 1. Persistence Strategy

FixFlow uses **MongoDB** managed via the **Mongoose ODM**. 

MongoDB's flexible document structure accommodates complaint tickets that evolve over time (e.g., status timelines, notes, and polymorphic resolution metadata), while Mongoose ensures strict schema enforcement, type safety, default values, and index definitions at the application level.

---

## 2. Collection Schemas & Data Models

### 2.1 `users` Collection

Stores account records for all system actors across all roles.

```javascript
{
  _id: ObjectId,
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email address format']
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false // Excluded from query projections by default for security
  },
  role: {
    type: String,
    enum: ['USER', 'TECHNICIAN', 'ADMIN'],
    default: 'USER'
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  specialization: {
    type: String, // Applicable for TECHNICIAN role (e.g. 'ELECTRICAL', 'PLUMBING', 'HVAC')
    enum: ['ELECTRICAL', 'PLUMBING', 'HVAC', 'CARPENTRY', 'GENERAL', 'NONE'],
    default: 'NONE'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: ISODate,
  updatedAt: ISODate
}
```

---

### 2.2 `complaints` Collection

The central record representing a maintenance request throughout its lifecycle.

```javascript
{
  _id: ObjectId,
  complaintNumber: {
    type: String,
    required: true,
    unique: true, // Formatted identifier e.g., "FIX-202610-0001"
    uppercase: true,
    trim: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 120
  },
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: [
      'electrical',
      'plumbing',
      'hvac',
      'carpentry',
      'appliance',
      'safety_security',
      'other'
    ],
    lowercase: true,
    trim: true
  },
  location: {
    building: { type: String, required: true, trim: true, maxlength: 60 },
    floor: { type: String, required: true, trim: true, maxlength: 30 },
    room: { type: String, required: true, trim: true, maxlength: 30 },
    description: { type: String, trim: true, default: '', maxlength: 200 }
  },
  priority: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    lowercase: true,
    trim: true
  },
  status: {
    type: String,
    required: true,
    enum: [
      'submitted',
      'assigned',
      'in_progress',
      'on_hold',
      'resolved',
      'closed',
      'rejected'
    ],
    default: 'submitted',
    lowercase: true,
    trim: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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
  createdAt: ISODate,
  updatedAt: ISODate
}
```

---

### 2.3 `complaint_histories` Collection (Immutable Audit Trail)

Maintains an immutable historical record of all state transitions, reassignments, and notes for auditability and SLA reporting.

```javascript
{
  _id: ObjectId,
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    required: true,
    index: true
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'CREATED',
      'ASSIGNMENT_CHANGED',
      'STATUS_CHANGED',
      'PRIORITY_CHANGED',
      'DETAILS_UPDATED',
      'RESOLVED',
      'CLOSED',
      'REOPENED'
    ]
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
}
```

---

### 2.4 `counters` Collection (Atomic Sequence Generator)

Guarantees atomic collision-safe sequential ticket numbering across concurrent requests without race conditions.

```javascript
{
  _id: "complaint_202610", // Partitioned monthly counter key
  seq: 42                  // Incremented atomically via findOneAndUpdate with $inc
}
```
  },
  note: {
    type: String,
    trim: true,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}
```

---

## 3. Database Indexes & Query Optimization

Indexes are critical for responsive queries as complaint volumes grow:

| Collection | Indexed Fields | Index Type | Purpose |
| :--- | :--- | :--- | :--- |
| `users` | `email: 1` | Unique | Fast lookup during login; enforces unique email accounts. |
| `complaints` | `ticketNumber: 1` | Unique | Instant lookup by ticket number. |
| `complaints` | `createdBy: 1, createdAt: -1` | Compound | Fast retrieval of user's personal complaint history. |
| `complaints` | `assignedTo: 1, status: 1` | Compound | Powers technician work order queue filtering. |
| `complaints` | `status: 1, priority: 1, createdAt: -1` | Compound | Powers admin triage list, sorting, and filtering. |
| `audit_logs` | `complaintId: 1, timestamp: 1` | Compound | Rapid chronological assembly of a complaint's activity timeline. |

---

## 4. Normalization vs. Embedding Trade-offs

- **User references (`createdBy`, `assignedTo`):** Referenced by `ObjectId` rather than embedded. This prevents stale user contact info (e.g., when a user or technician updates their phone number).
- **Location data (`location`):** Embedded directly inside the complaint document because location (building, floor, room) is immutable to that specific incident report once created.
- **Audit Logs:** Stored in a separate collection to prevent the `complaints` document from unbounded growth under frequent status updates, keeping document sizes lean and memory-efficient.
