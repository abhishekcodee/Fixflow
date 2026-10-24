import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const ALLOWED_ROLES = ['user', 'admin', 'technician'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [60, 'Name must not exceed 60 characters']
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/,
        'Please provide a valid email address'
      ]
    },
    passwordHash: {
      type: String,
      required: [
        function () {
          return !this.githubId;
        },
        'Password hash is required'
      ],
      select: false // Never project or return passwordHash in standard queries
    },
    githubId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    avatarUrl: {
      type: String,
      trim: true
    },
    role: {
      type: String,
      enum: {
        values: ALLOWED_ROLES,
        message: 'Role must be either user, admin, or technician'
      },
      default: 'user',
      lowercase: true,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

/**
 * Static method to hash a plaintext password with bcrypt.
 * Uses 12 salt rounds for strong cryptographic defense.
 * @param {string} plainPassword
 * @returns {Promise<string>}
 */
userSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainPassword, salt);
};

/**
 * Instance method to compare candidate password against stored passwordHash.
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) {
    throw new Error('Password hash not loaded in user document. Ensure select("+passwordHash") was called.');
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Returns a sanitized plain object representation of the user.
 * Explicitly excludes passwordHash.
 */
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    avatarUrl: this.avatarUrl || null,
    githubId: this.githubId || null,
    isActive: this.isActive,
    isVerified: this.isVerified,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
