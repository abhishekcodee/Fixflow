import prisma from '../config/prisma.js';

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

const formatComplaint = (c) => {
  if (!c) return null;
  const obj = { ...c };
  const resolvedId = c.id || c._id;
  obj.id = resolvedId ? String(resolvedId) : undefined;
  obj._id = obj.id;

  obj.location = {
    building: c.building || (c.location && c.location.building) || '',
    floor: c.floor || (c.location && c.location.floor) || '',
    room: c.room || (c.location && (c.location.room || c.location.roomOrUnit)) || '',
    description: c.locationDescription || (c.location && (c.location.description || c.location.additionalNotes)) || '',
    latitude: c.latitude !== undefined && c.latitude !== null ? c.latitude : (c.location && c.location.latitude) ?? null,
    longitude: c.longitude !== undefined && c.longitude !== null ? c.longitude : (c.location && c.location.longitude) ?? null,
    address: c.address || (c.location && c.location.address) || ''
  };

  obj.feedback = c.feedbackRating
    ? {
      rating: c.feedbackRating,
      comments: c.feedbackComments || '',
      submittedAt: c.feedbackSubmittedAt
    }
    : (c.feedback || null);

  obj.createdBy = c.createdBy
    ? (typeof c.createdBy === 'object' && (c.createdBy.id || c.createdBy._id)
      ? {
        id: String(c.createdBy.id || c.createdBy._id),
        _id: String(c.createdBy._id || c.createdBy.id),
        name: c.createdBy.name,
        email: c.createdBy.email,
        role: c.createdBy.role,
        avatarUrl: c.createdBy.avatarUrl || null
      }
      : c.createdBy)
    : (c.createdById || null);

  obj.assignedTo = c.assignedTo
    ? (typeof c.assignedTo === 'object' && (c.assignedTo.id || c.assignedTo._id)
      ? {
        id: String(c.assignedTo.id || c.assignedTo._id),
        _id: String(c.assignedTo._id || c.assignedTo.id),
        name: c.assignedTo.name,
        email: c.assignedTo.email,
        role: c.assignedTo.role,
        avatarUrl: c.assignedTo.avatarUrl || null
      }
      : c.assignedTo)
    : (c.assignedToId || null);

  obj.toSafeObject = function () {
    return {
      id: this.id,
      _id: this.id,
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
      resolutionNotes: this.resolutionNotes || '',
      resolvedAt: this.resolvedAt,
      closedAt: this.closedAt,
      feedback: this.feedback,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  };

  obj.toJSON = function () {
    return this.toSafeObject ? this.toSafeObject() : this;
  };

  obj.save = async function () {
    const idToUpdate = this.id || this._id;
    if (!idToUpdate) return this;
    try {
      const updated = await Complaint.findByIdAndUpdate(idToUpdate, this);
      if (updated) {
        Object.assign(this, updated);
      }
    } catch {
      // In-memory fallback if not connected to database
    }
    return this;
  };

  return obj;
};

const buildPrismaWhere = (query = {}) => {
  const where = {};
  if (query.createdBy) where.createdById = String(query.createdBy);
  if (query.assignedTo) where.assignedToId = String(query.assignedTo);
  if (query.status) where.status = query.status;
  if (query.category) where.category = query.category;
  if (query.priority) where.priority = query.priority;
  if (query.complaintNumber) where.complaintNumber = query.complaintNumber;

  if (query.$or && Array.isArray(query.$or)) {
    where.OR = query.$or.map((clause) => {
      const orClause = {};
      for (const [key, val] of Object.entries(clause)) {
        const pattern = typeof val === 'object' && val.$regex ? val.$regex : val;
        if (key === 'title') orClause.title = { contains: pattern };
        else if (key === 'complaintNumber') orClause.complaintNumber = { contains: pattern };
        else if (key === 'description') orClause.description = { contains: pattern };
      }
      return orClause;
    });
  }
  return where;
};

class ComplaintQueryBuilder {
  constructor(where = {}) {
    this._where = buildPrismaWhere(where);
    this._orderBy = { createdAt: 'desc' };
    this._skip = undefined;
    this._take = undefined;
  }

  sort(sortObj) {
    if (sortObj) {
      if (typeof sortObj === 'string') {
        const parts = sortObj.split(' ');
        const field = parts[0].startsWith('-') ? parts[0].slice(1) : parts[0];
        const dir = parts[0].startsWith('-') ? 'desc' : 'asc';
        this._orderBy = { [field]: dir };
      } else {
        const key = Object.keys(sortObj)[0];
        const dir = sortObj[key] === -1 || sortObj[key] === 'desc' ? 'desc' : 'asc';
        this._orderBy = { [key]: dir };
      }
    }
    return this;
  }

  skip(n) {
    this._skip = Number(n);
    return this;
  }

  limit(n) {
    this._take = Number(n);
    return this;
  }

  populate() {
    return this;
  }

  async exec() {
    const list = await prisma.complaint.findMany({
      where: this._where,
      orderBy: this._orderBy,
      skip: this._skip,
      take: this._take,
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
        assignedTo: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } }
      }
    });
    return list.map(formatComplaint);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

export class Complaint {
  static find(query = {}) {
    return new ComplaintQueryBuilder(query);
  }

  static async findById(id) {
    if (!id) return null;
    const res = await prisma.complaint.findUnique({
      where: { id: String(id) },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
        assignedTo: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } }
      }
    });
    const formatted = formatComplaint(res);
    if (formatted) {
      formatted.populate = function () { return this; };
    }
    return formatted;
  }

  static async findOne(query = {}) {
    const where = buildPrismaWhere(query);
    const res = await prisma.complaint.findFirst({
      where,
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
        assignedTo: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } }
      }
    });
    const formatted = formatComplaint(res);
    if (formatted) {
      formatted.populate = function () { return this; };
    }
    return formatted;
  }

  static async create(data) {
    const loc = data.location || {};
    const created = await prisma.complaint.create({
      data: {
        complaintNumber: data.complaintNumber,
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority || 'medium',
        status: data.status || 'submitted',
        building: loc.building || '',
        floor: loc.floor || '',
        room: loc.room || loc.roomOrUnit || '',
        locationDescription: loc.description || loc.additionalNotes || '',
        latitude: loc.latitude !== undefined && loc.latitude !== null ? Number(loc.latitude) : null,
        longitude: loc.longitude !== undefined && loc.longitude !== null ? Number(loc.longitude) : null,
        address: loc.address || '',
        createdById: String(data.createdBy?.id || data.createdBy?._id || data.createdBy),
        assignedToId: data.assignedTo ? String(data.assignedTo?.id || data.assignedTo?._id || data.assignedTo) : null,
        assignedAt: data.assignedAt || null
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
        assignedTo: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } }
      }
    });
    return formatComplaint(created);
  }

  static async findByIdAndUpdate(id, update) {
    let data = { ...update };
    if (data.$set) data = { ...data.$set };

    const prismaData = {};
    if (data.status) prismaData.status = data.status;
    if (data.priority) prismaData.priority = data.priority;
    if (data.resolutionNotes !== undefined) prismaData.resolutionNotes = data.resolutionNotes;
    if (data.resolvedAt !== undefined) prismaData.resolvedAt = data.resolvedAt;
    if (data.closedAt !== undefined) prismaData.closedAt = data.closedAt;
    if (data.assignedTo !== undefined) {
      prismaData.assignedToId = data.assignedTo ? String(data.assignedTo?.id || data.assignedTo?._id || data.assignedTo) : null;
    }
    if (data.assignedAt !== undefined) prismaData.assignedAt = data.assignedAt;

    if (data.location) {
      if (data.location.building) prismaData.building = data.location.building;
      if (data.location.floor) prismaData.floor = data.location.floor;
      if (data.location.room) prismaData.room = data.location.room;
      if (data.location.description !== undefined) prismaData.locationDescription = data.location.description;
      if (data.location.latitude !== undefined) prismaData.latitude = data.location.latitude;
      if (data.location.longitude !== undefined) prismaData.longitude = data.location.longitude;
      if (data.location.address !== undefined) prismaData.address = data.location.address;
    }

    if (data.feedback) {
      if (data.feedback.rating !== undefined) prismaData.feedbackRating = data.feedback.rating;
      if (data.feedback.comments !== undefined) prismaData.feedbackComments = data.feedback.comments;
      if (data.feedback.submittedAt !== undefined) prismaData.feedbackSubmittedAt = data.feedback.submittedAt;
    }

    const updated = await prisma.complaint.update({
      where: { id: String(id) },
      data: prismaData,
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
        assignedTo: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } }
      }
    });
    return formatComplaint(updated);
  }

  static async countDocuments(query = {}) {
    const where = buildPrismaWhere(query);
    return prisma.complaint.count({ where });
  }

  static async deleteMany(filter = {}) {
    const where = buildPrismaWhere(filter);
    try {
      const res = await prisma.complaint.deleteMany({ where });
      return { deletedCount: res.count };
    } catch {
      return { deletedCount: 0 };
    }
  }

  static async deleteOne(filter = {}) {
    try {
      const where = {};
      if (filter.id || filter._id) where.id = String(filter.id || filter._id);
      await prisma.complaint.delete({ where });
      return { deletedCount: 1 };
    } catch {
      return { deletedCount: 0 };
    }
  }

  constructor(data = {}) {
    Object.assign(this, formatComplaint(data));
  }

  async save() {
    const idToUpdate = this.id || this._id;
    if (!idToUpdate) return this;
    try {
      const updated = await Complaint.findByIdAndUpdate(idToUpdate, this);
      if (updated) {
        Object.assign(this, updated);
      }
    } catch {
      // In-memory fallback
    }
    return this;
  }

  toSafeObject() {
    return {
      id: this.id,
      _id: this.id,
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
      resolutionNotes: this.resolutionNotes || '',
      resolvedAt: this.resolvedAt,
      closedAt: this.closedAt,
      feedback: this.feedback,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toJSON() {
    return this.toSafeObject();
  }
}

export default Complaint;
