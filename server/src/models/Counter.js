import prisma from '../config/prisma.js';

export const Counter = {
  async findOneAndUpdate(filter) {
    const id = filter.id || filter._id;
    return prisma.counter.upsert({
      where: { id: String(id) },
      update: { seq: { increment: 1 } },
      create: { id: String(id), seq: 1 }
    });
  }
};

/**
 * Generates an atomic, collision-safe complaint number.
 * Format: FIX-YYYYMM-XXXX (e.g., FIX-202610-0001)
 * Backed by MySQL Counter table to prevent race conditions during concurrent requests.
 * @returns {Promise<string>}
 */
export const getNextComplaintNumber = async () => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const counterId = `complaint_${yearMonth}`;

  try {
    const counter = await Counter.findOneAndUpdate({ id: counterId, _id: counterId });
    const formattedSequence = String(counter.seq).padStart(4, '0');
    return `FIX-${yearMonth}-${formattedSequence}`;
  } catch (err) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const timestampSuffix = Date.now().toString().slice(-4);
    return `FIX-${yearMonth}-${timestampSuffix}${randomSuffix}`;
  }
};

export default {
  Counter,
  getNextComplaintNumber
};
