import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';

const attachMethods = (ev) => {
  if (!ev) return null;
  const item = { ...ev };
  const resolvedId = ev.id || ev._id;
  item.id = resolvedId ? String(resolvedId) : undefined;
  item._id = item.id;

  item.compareOtp = async function (candidateOtp) {
    if (!this.otpHash) return false;
    return bcrypt.compare(String(candidateOtp).trim(), this.otpHash);
  };

  item.save = async function () {
    const updated = await EmailVerification.findOneAndUpdate({ email: this.email }, this);
    if (updated) {
      Object.assign(this, updated);
    }
    return this;
  };

  return item;
};

export class EmailVerification {
  static async hashOtp(plainOtp) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(String(plainOtp).trim(), salt);
  }

  static async findOne(query = {}) {
    const email = query.email ? String(query.email).trim().toLowerCase() : undefined;
    if (!email) {
      if (query.id || query._id) {
        const id = String(query.id || query._id);
        const item = await prisma.emailVerification.findUnique({ where: { id } });
        return attachMethods(item);
      }
      return null;
    }
    const item = await prisma.emailVerification.findFirst({
      where: { email }
    });
    return attachMethods(item);
  }

  static async create(data) {
    return this.findOneAndUpdate({ email: data.email }, data);
  }

  static async findOneAndUpdate(filter, update) {
    const email = filter.email ? String(filter.email).trim().toLowerCase() : undefined;
    const data = {
      email,
      otpHash: update.otpHash,
      pendingName: update.pendingName,
      pendingPasswordHash: update.pendingPasswordHash,
      pendingRole: update.pendingRole || 'user',
      attempts: update.attempts !== undefined ? update.attempts : 0,
      lastResendAt: update.lastResendAt || new Date(),
      expiresAt: update.expiresAt
    };

    const item = await prisma.emailVerification.upsert({
      where: { email },
      update: data,
      create: data
    });
    return attachMethods(item);
  }

  static async deleteOne(filter = {}) {
    let where = {};
    if (filter.email) {
      where.email = String(filter.email).trim().toLowerCase();
    } else if (filter.id || filter._id) {
      where.id = String(filter.id || filter._id);
    }

    if (!where.email && !where.id) return { deletedCount: 0 };

    try {
      if (where.email) {
        await prisma.emailVerification.delete({ where: { email: where.email } });
      } else {
        await prisma.emailVerification.delete({ where: { id: where.id } });
      }
      return { deletedCount: 1 };
    } catch {
      return { deletedCount: 0 };
    }
  }

  static async deleteMany(filter = {}) {
    try {
      if (filter.expiresAt && filter.expiresAt.$lt) {
        const res = await prisma.emailVerification.deleteMany({
          where: { expiresAt: { lt: filter.expiresAt.$lt } }
        });
        return { deletedCount: res.count };
      }
      const res = await prisma.emailVerification.deleteMany({});
      return { deletedCount: res.count };
    } catch {
      return { deletedCount: 0 };
    }
  }

  constructor(data = {}) {
    Object.assign(this, attachMethods(data));
  }

  async save() {
    const updated = await EmailVerification.findOneAndUpdate({ email: this.email }, this);
    if (updated) {
      Object.assign(this, updated);
    }
    return this;
  }
}

export default EmailVerification;
