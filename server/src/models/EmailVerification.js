import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';

const attachMethods = (ev) => {
  if (!ev) return null;
  const item = { ...ev };
  item._id = item.id;
  item.compareOtp = async function (candidateOtp) {
    return bcrypt.compare(String(candidateOtp).trim(), this.otpHash);
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
    if (!email) return null;
    const item = await prisma.emailVerification.findFirst({
      where: { email }
    });
    return attachMethods(item);
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
    const email = filter.email ? String(filter.email).trim().toLowerCase() : undefined;
    if (!email) return { deletedCount: 0 };
    try {
      await prisma.emailVerification.delete({ where: { email } });
      return { deletedCount: 1 };
    } catch {
      return { deletedCount: 0 };
    }
  }

  static async deleteMany(filter = {}) {
    if (filter.expiresAt && filter.expiresAt.$lt) {
      const res = await prisma.emailVerification.deleteMany({
        where: { expiresAt: { lt: filter.expiresAt.$lt } }
      });
      return { deletedCount: res.count };
    }
    const res = await prisma.emailVerification.deleteMany({});
    return { deletedCount: res.count };
  }
}

export default EmailVerification;
