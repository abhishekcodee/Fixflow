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
  static async logEvent({
    complaintId,
    actorId,
    action,
    previousState = null,
    newState = null,
    note = ''
  }) {
    const created = await prisma.complaintHistory.create({
      data: {
        complaintId: String(complaintId),
        actorId: String(actorId),
        action,
        previousState: previousState ? previousState : undefined,
        newState: newState ? newState : undefined,
        note: note || ''
      },
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true, avatarUrl: true }
        }
      }
    });
    return formatHistory(created);
  }

  static async find(query = {}) {
    let where = {};
    if (query.complaintId) where.complaintId = String(query.complaintId);
    if (query.actor) where.actorId = String(query.actor);

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
  }

  static async create(data) {
    return this.logEvent({
      complaintId: data.complaintId,
      actorId: data.actor || data.actorId,
      action: data.action,
      previousState: data.previousState,
      newState: data.newState,
      note: data.note
    });
  }
}

export default ComplaintHistory;
