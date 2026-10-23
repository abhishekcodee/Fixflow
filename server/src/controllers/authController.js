import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { signToken } from '../utils/token.js';
import { validateRegistrationInput, validateLoginInput } from '../utils/validation.js';

/**
 * @route   POST /api/v1/auth/register
 * @desc    Public user registration (Always assigns role: 'user')
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate registration input
    const validation = validateRegistrationInput({ name, email, password });
    if (!validation.isValid) {
      return next(
        new AppError('Validation failed on registration input.', 400, 'VALIDATION_ERROR', validation.errors)
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing account with same email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return next(
        new AppError('An account with this email address already exists.', 409, 'EMAIL_ALREADY_EXISTS')
      );
    }

    // Securely hash the password
    const passwordHash = await User.hashPassword(password);

    // Create user: Public registration strictly forces role: 'user'
    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'user', // Enforce unprivileged role
      isActive: true
    });

    // Generate JWT
    const token = signToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: newUser.toSafeObject(),
        token
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticates credentials and returns a signed JWT
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate login input format
    const validation = validateLoginInput({ email, password });
    if (!validation.isValid) {
      return next(
        new AppError('Email and password are required.', 400, 'VALIDATION_ERROR', validation.errors)
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query user and explicitly select passwordHash
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

    // Generic error to prevent email enumeration attacks
    if (!user) {
      return next(new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS'));
    }

    if (!user.isActive) {
      return next(
        new AppError('This account has been deactivated. Please contact an administrator.', 403, 'ACCOUNT_DEACTIVATED')
      );
    }

    // Compare candidate password against stored bcrypt hash
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return next(new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS'));
    }

    // Issue JWT
    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toSafeObject(),
        token
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/v1/auth/me
 * @desc    Returns current authenticated user's profile
 * @access  Authenticated
 */
export const getMe = (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user
    }
  });
};

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Client-directed stateless session termination
 * @access  Public
 * @note    FixFlow uses stateless JWTs. Logout requires the client to purge the stored token.
 */
export const logout = (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully. Stateless session ended; client must discard the token.'
  });
};

/**
 * @route   GET /api/v1/auth/technicians
 * @desc    Retrieves active technicians for task assignment (Admin only)
 * @access  Admin only
 */
export const getTechnicians = async (req, res, next) => {
  try {
    const technicians = await User.find({ role: 'technician', isActive: true })
      .select('name email role isActive createdAt')
      .sort({ name: 1 })
      .lean();

    const safeTechnicians = Array.isArray(technicians)
      ? technicians.map((t) => ({
          _id: t._id,
          name: t.name,
          email: t.email,
          role: t.role
        }))
      : [];

    return res.status(200).json({
      success: true,
      data: {
        technicians: safeTechnicians
      }
    });
  } catch (err) {
    next(err);
  }
};

export default {
  register,
  login,
  getMe,
  logout,
  getTechnicians
};

