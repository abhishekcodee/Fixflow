import prisma from '../config/prisma.js';

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

const formatHistory = (h) => {
  if (!h) return null;
  return {
    id: h.id,
    _id: h.id,
    complaintId: h.complaintId,
    actor: h.actor
      ? {
        id: h.actor.id,
        _id: h.actor.id,
        name: h.actor.name,
        email: h.actor.email,
        role: h.actor.role,
        avatarUrl: h.actor.avatarUrl || null
      }
      : h.actorId,
    action: h.action,
    previousState: h.previousState,
    newState: h.newState,
    note: h.note || '',
    timestamp: h.timestamp
  };
};

export class ComplaintHistory {
  static async create(data) {
    const actorId = data.actorId || (typeof data.actor === 'object' ? (data.actor.id || data.actor._id) : data.actor);
    const complaintId = data.complaintId;
    const action = data.action;
    const previousState = data.previousState ? data.previousState : undefined;
    const newState = data.newState ? data.newState : undefined;
    const note = data.note || '';

    try {
      const created = await prisma.complaintHistory.create({
        data: {
          complaintId: String(complaintId),
          actorId: String(actorId),
          action,
          previousState,
          newState,
          note
        },
        include: {
          actor: {
            select: { id: true, name: true, email: true, role: true, avatarUrl: true }
          }
        }
      });
      return formatHistory(created);
    } catch {
      return {
        id: 'mock-history-id',
        _id: 'mock-history-id',
        complaintId: String(complaintId),
        actorId: String(actorId),
        action,
        previousState,
        newState,
        note,
        timestamp: new Date()
      };
    }
  }

  static async logEvent(data) {
    return this.create(data);
  }

  static async find(query = {}) {
    let where = {};
    if (query.complaintId) where.complaintId = String(query.complaintId);
    if (query.actor) where.actorId = String(query.actor);

    try {
      const historyItems = await prisma.complaintHistory.findMany({
        where,
        orderBy: { timestamp: 'asc' },
        include: {
          actor: {
            select: { id: true, name: true, email: true, role: true, avatarUrl: true }
          }
        }
      });

      const formatted = historyItems.map(formatHistory);
      formatted.sort = function () { return this; };
      formatted.populate = function () { return this; };
      return formatted;
    } catch {
      const empty = [];
      empty.sort = function () { return this; };
      empty.populate = function () { return this; };
      return empty;
    }
  }

  static async deleteMany(filter = {}) {
    let where = {};
    if (filter.complaintId) where.complaintId = String(filter.complaintId);
    try {
      const res = await prisma.complaintHistory.deleteMany({ where });
      return { deletedCount: res.count };
    } catch {
      return { deletedCount: 0 };
    }
  }
}

export default ComplaintHistory;
