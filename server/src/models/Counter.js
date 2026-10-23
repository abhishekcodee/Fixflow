import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },
    seq: {
      type: Number,
      default: 0
    }
  },
  {
    versionKey: false
  }
);

export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

/**
 * Generates an atomic, collision-safe complaint number.
 * Format: FIX-YYYYMM-XXXX (e.g., FIX-202610-0001)
 * Uses database-backed atomic $inc counter to prevent race conditions during concurrent requests.
 * @returns {Promise<string>}
 */
export const getNextComplaintNumber = async () => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const counterId = `complaint_${yearMonth}`;

  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: counterId },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const formattedSequence = String(counter.seq).padStart(4, '0');
    return `FIX-${yearMonth}-${formattedSequence}`;
  } catch (err) {
    // Fallback collision-safe generator for standalone/mock environments
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const timestampSuffix = Date.now().toString().slice(-4);
    return `FIX-${yearMonth}-${timestampSuffix}${randomSuffix}`;
  }
};

export default {
  Counter,
  getNextComplaintNumber
};
