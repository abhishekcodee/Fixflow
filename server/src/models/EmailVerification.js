import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const emailVerificationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email address is required'],
      lowercase: true,
      trim: true,
      index: true
    },
    otpHash: {
      type: String,
      required: [true, 'OTP hash is required']
    },
    pendingName: {
      type: String,
      required: [true, 'Pending name is required'],
      trim: true
    },
    pendingPasswordHash: {
      type: String,
      required: [true, 'Pending password hash is required']
    },
    pendingRole: {
      type: String,
      enum: ['user', 'technician'],
      default: 'user'
    },
    attempts: {
      type: Number,
      default: 0
    },
    lastResendAt: {
      type: Date,
      default: Date.now
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
 * Hashes a plaintext 6-digit OTP using bcrypt with 10 salt rounds.
 */
emailVerificationSchema.statics.hashOtp = async function (plainOtp) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(String(plainOtp).trim(), salt);
};

/**
 * Compares candidate OTP against stored bcrypt hash.
 */
emailVerificationSchema.methods.compareOtp = async function (candidateOtp) {
  return bcrypt.compare(String(candidateOtp).trim(), this.otpHash);
};

export const EmailVerification =
  mongoose.models.EmailVerification ||
  mongoose.model('EmailVerification', emailVerificationSchema);

export default EmailVerification;
