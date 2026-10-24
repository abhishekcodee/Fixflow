import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const passwordResetSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email address is required'],
      lowercase: true,
      trim: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: [true, 'Reset token hash is required']
    },
    attempts: {
      type: Number,
      default: 0
    },
    used: {
      type: Boolean,
      default: false
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // Automatic TTL expiration
    }
  },
  {
    timestamps: true
  }
);

/**
 * Hashes a plaintext reset code or token with bcrypt.
 */
passwordResetSchema.statics.hashToken = async function (plainToken) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(String(plainToken).trim(), salt);
};

/**
 * Compares candidate token against stored hash.
 */
passwordResetSchema.methods.compareToken = async function (candidateToken) {
  return bcrypt.compare(String(candidateToken).trim(), this.tokenHash);
};

export const PasswordReset =
  mongoose.models.PasswordReset ||
  mongoose.model('PasswordReset', passwordResetSchema);

export default PasswordReset;
