import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';

const attachMethods = (pr) => {
  if (!pr) return null;
  const item = { ...pr };
  const resolvedId = pr.id || pr._id;
  item.id = resolvedId ? String(resolvedId) : undefined;
  item._id = item.id;

  item.compareToken = async function (candidateToken) {
    if (!this.tokenHash) return false;
    return bcrypt.compare(String(candidateToken).trim(), this.tokenHash);
  };

  item.save = async function () {
    const updated = await prisma.passwordReset.update({
      where: { id: this.id },
      data: {
        tokenHash: this.tokenHash,
        attempts: this.attempts,
        used: this.used,
        expiresAt: this.expiresAt
      }
    });
    Object.assign(this, attachMethods(updated));
    return this;
  };

  return item;
};

export class PasswordReset {
  static async hashToken(plainToken) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(String(plainToken).trim(), salt);
  }

  static async findOne(query = {}) {
    let where = {};
    if (query.email) where.email = String(query.email).trim().toLowerCase();
    if (query.used !== undefined) where.used = query.used;
    if (query.expiresAt && query.expiresAt.$gt) {
      where.expiresAt = { gt: query.expiresAt.$gt };
    }

    const item = await prisma.passwordReset.findFirst({
      where,
      orderBy: { createdAt: 'desc' }
    });
    return attachMethods(item);
  }

  static async create(data) {
    const created = await prisma.passwordReset.create({
      data: {
        email: data.email.trim().toLowerCase(),
        tokenHash: data.tokenHash,
        attempts: data.attempts || 0,
        used: data.used !== undefined ? data.used : false,
        expiresAt: data.expiresAt
      }
    });
    return attachMethods(created);
  }

  static async findOneAndUpdate(filter = {}, update = {}, options = {}) {
    const email = filter.email ? String(filter.email).trim().toLowerCase() : undefined;
    const data = {
      email,
      tokenHash: update.tokenHash,
      attempts: update.attempts !== undefined ? update.attempts : 0,
      used: update.used !== undefined ? update.used : false,
      expiresAt: update.expiresAt
    };

    if (email) {
      const existing = await prisma.passwordReset.findFirst({
        where: { email },
        orderBy: { createdAt: 'desc' }
      });
      if (existing) {
        const updated = await prisma.passwordReset.update({
          where: { id: existing.id },
          data
        });
        return attachMethods(updated);
      }
      if (options.upsert) {
        const created = await prisma.passwordReset.create({ data });
        return attachMethods(created);
      }
    }
    return null;
  }

  static async findByIdAndUpdate(id, update) {
    let data = { ...update };
    if (data.$set) data = { ...data.$set };
    delete data._id;
    delete data.id;

    const updated = await prisma.passwordReset.update({
      where: { id: String(id) },
      data
    });
    return attachMethods(updated);
  }

  static async deleteOne(filter = {}) {
    let where = {};
    if (filter.id || filter._id) {
      where.id = String(filter.id || filter._id);
    } else if (filter.email) {
      where.email = String(filter.email).trim().toLowerCase();
    }

    if (!where.id && !where.email) return { deletedCount: 0 };

    try {
      if (where.id) {
        await prisma.passwordReset.delete({ where: { id: where.id } });
      } else {
        const item = await prisma.passwordReset.findFirst({ where: { email: where.email } });
        if (item) {
          await prisma.passwordReset.delete({ where: { id: item.id } });
        }
      }
      return { deletedCount: 1 };
    } catch {
      return { deletedCount: 0 };
    }
  }

  static async deleteMany(filter = {}) {
    let where = {};
    if (filter.email) {
      if (typeof filter.email === 'object' && filter.email.$in && Array.isArray(filter.email.$in)) {
        where.email = { in: filter.email.$in.map((e) => String(e).trim().toLowerCase()) };
      } else {
        where.email = String(filter.email).trim().toLowerCase();
      }
    }
    if (filter.expiresAt && filter.expiresAt.$lt) {
      where.expiresAt = { lt: filter.expiresAt.$lt };
    }
    try {
      const res = await prisma.passwordReset.deleteMany({ where });
      return { deletedCount: res.count };
    } catch {
      return { deletedCount: 0 };
    }
  }

  constructor(data = {}) {
    Object.assign(this, attachMethods(data));
  }

  async save() {
    if (!this.id) return this;
    const updated = await prisma.passwordReset.update({
      where: { id: this.id },
      data: {
        tokenHash: this.tokenHash,
        attempts: this.attempts,
        used: this.used,
        expiresAt: this.expiresAt
      }
    });
    Object.assign(this, attachMethods(updated));
    return this;
  }
}

export default PasswordReset;
