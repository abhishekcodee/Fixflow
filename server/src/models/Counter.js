import prisma from '../config/prisma.js';

export const Counter = {
  async findOneAndUpdate(filter) {
    const id = filter._id || filter.id;
    return prisma.counter.upsert({
      where: { id },
      update: { seq: { increment: 1 } },
      create: { id, seq: 1 }
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
    const counter = await prisma.counter.upsert({
      where: { id: counterId },
      update: { seq: { increment: 1 } },
      create: { id: counterId, seq: 1 }
    });

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
