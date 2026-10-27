import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';

const attachMethods = (pr) => {
  if (!pr) return null;
  const item = { ...pr };
  item._id = item.id;
  item.compareToken = async function (candidateToken) {
    return bcrypt.compare(String(candidateToken).trim(), this.tokenHash);
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

  static async deleteMany(filter = {}) {
    let where = {};
    if (filter.email) where.email = filter.email;
    if (filter.expiresAt && filter.expiresAt.$lt) {
      where.expiresAt = { lt: filter.expiresAt.$lt };
    }
    const res = await prisma.passwordReset.deleteMany({ where });
    return { deletedCount: res.count };
  }
}

export default PasswordReset;
