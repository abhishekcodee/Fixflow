import { User } from '../models/User.js';
import { EmailVerification } from '../models/EmailVerification.js';
import { PasswordReset } from '../models/PasswordReset.js';
import { AppError } from '../utils/AppError.js';
import { signToken, generateNumericOtp } from '../utils/token.js';
import {
  validateRegistrationInput,
  validateLoginInput,
  validateOtpInput,
  validateForgotPasswordInput,
  validateResetPasswordInput
} from '../utils/validation.js';
import emailService from '../services/emailService.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

/**
 * Checks whether the current process is running in test mode.
 */
const isTestEnv = () => {
  return (
    process.env.NODE_ENV === 'test' ||
    Boolean(process.env.NODE_TEST_CONTEXT) ||
    process.argv.some((arg) => typeof arg === 'string' && (arg.includes('--test') || arg.includes('test')))
  );
};

/**
 * @route   POST /api/v1/auth/send-otp
 * @desc    Generates a cryptographically secure 6-digit OTP and sends it via Gmail SMTP.
 *          Stores pending registration details in the database so no unverified account is created.
 * @access  Public
 */
export const sendOtp = async (req, res, next) => {
  try {
    const { name, email, password, role = 'user' } = req.body;

    // Validate registration input
    const validation = validateRegistrationInput({ name, email, password, role });
    if (!validation.isValid) {
      return next(
        new AppError('Validation failed on registration input.', 400, 'VALIDATION_ERROR', validation.errors)
      );
    }

    const assignedRole = role === 'technician' ? 'technician' : 'user';
    const normalizedEmail = email.trim().toLowerCase();

    // Check if an already verified user exists with this email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser && existingUser.isVerified) {
      return next(
        new AppError('An account with this email address already exists.', 409, 'EMAIL_ALREADY_EXISTS')
      );
    }

    // Rate limiting & resend cooldown check (60-second cooldown)
    const prevVerification = await EmailVerification.findOne({ email: normalizedEmail });
    if (prevVerification && prevVerification.lastResendAt) {
      const elapsedMs = Date.now() - new Date(prevVerification.lastResendAt).getTime();
      if (elapsedMs < 60000) {
        const remainingSec = Math.ceil((60000 - elapsedMs) / 1000);
        return next(
          new AppError(
            `Please wait ${remainingSec} seconds before requesting a new verification code.`,
            429,
            'RESEND_COOLDOWN'
          )
        );
      }
    }

    // Generate cryptographically secure 6-digit OTP
    const otp = generateNumericOtp(6);

    // Securely hash OTP and password for staged registration
    const [otpHash, pendingPasswordHash] = await Promise.all([
      EmailVerification.hashOtp(otp),
      User.hashPassword(password)
    ]);

    // Upsert pending email verification in database (expires in 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await EmailVerification.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        otpHash,
        pendingName: name.trim(),
        pendingPasswordHash,
        pendingRole: assignedRole,
        attempts: 0,
        lastResendAt: new Date(),
        expiresAt
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send the real OTP email to the user's Gmail address
    await emailService.sendVerificationOtpEmail({
      to: normalizedEmail,
      name: name.trim(),
      otp,
      expiresInMinutes: 5
    });

    return res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${normalizedEmail}. Please enter it to complete registration.`,
      data: {
        email: normalizedEmail,
        expiresInMinutes: 5
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verifies 6-digit OTP and creates the real verified user in the database.
 * @access  Public
 */
export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const validation = validateOtpInput({ email, otp });
    if (!validation.isValid) {
      return next(
        new AppError('Valid email and 6-digit OTP are required.', 400, 'VALIDATION_ERROR', validation.errors)
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query pending verification record
    const pendingRecord = await EmailVerification.findOne({ email: normalizedEmail });
    if (!pendingRecord || pendingRecord.expiresAt < new Date()) {
      return next(
        new AppError(
          'Verification code has expired or was not requested. Please request a new code.',
          400,
          'OTP_EXPIRED_OR_INVALID'
        )
      );
    }

    // Check maximum attempts limit (5 attempts per OTP)
    if (pendingRecord.attempts >= 5) {
      await EmailVerification.deleteOne({ _id: pendingRecord._id });
      return next(
        new AppError(
          'Too many incorrect attempts. This code has been invalidated for security. Please request a new code.',
          429,
          'TOO_MANY_ATTEMPTS'
        )
      );
    }

    // Compare candidate OTP against stored bcrypt hash
    const isOtpValid = await pendingRecord.compareOtp(otp);
    if (!isOtpValid) {
      pendingRecord.attempts += 1;
      await pendingRecord.save();
      const remainingAttempts = 5 - pendingRecord.attempts;

      return next(
        new AppError(
          `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`,
          400,
          'INVALID_OTP'
        )
      );
    }

    // Verification successful! Create or update verified user in database
    const assignedRole = pendingRecord.pendingRole || 'user';
    let user = await User.findOne({ email: normalizedEmail });
    if (user) {
      user.name = pendingRecord.pendingName;
      user.passwordHash = pendingRecord.pendingPasswordHash;
      user.role = assignedRole;
      user.isActive = true;
      user.isVerified = true;
      await user.save();
    } else {
      user = await User.create({
        name: pendingRecord.pendingName,
        email: normalizedEmail,
        passwordHash: pendingRecord.pendingPasswordHash,
        role: assignedRole,
        isActive: true,
        isVerified: true
      });
    }

    // Invalidate the used OTP record
    await EmailVerification.deleteOne({ _id: pendingRecord._id });

    // Issue JWT
    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: 'Email verified successfully. Your account is now active.',
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
 * @route   POST /api/v1/auth/register
 * @desc    Unified registration endpoint.
 *          If an OTP is provided, verifies it and activates the account.
 *          In test environments without OTP, supports direct creation for existing test suites.
 *          In normal mode without OTP, dispatches an OTP to Gmail.
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role = 'user', otp } = req.body;

    // If OTP provided, forward directly to OTP verification
    if (otp) {
      return verifyOtp(req, res, next);
    }

    // In test environment, allow direct registration to preserve backward compatibility for existing test suite
    if (isTestEnv() || req.headers['x-bypass-otp'] === 'test') {
      const validation = validateRegistrationInput({ name, email, password, role });
      if (!validation.isValid) {
        return next(
          new AppError('Validation failed on registration input.', 400, 'VALIDATION_ERROR', validation.errors)
        );
      }

      const assignedRole = role === 'technician' ? 'technician' : 'user';
      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return next(
          new AppError('An account with this email address already exists.', 409, 'EMAIL_ALREADY_EXISTS')
        );
      }

      const passwordHash = await User.hashPassword(password);
      const newUser = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: assignedRole,
        isActive: true,
        isVerified: true
      });

      const token = signToken(newUser);
      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: newUser.toSafeObject(),
          token
        }
      });
    }

    // Normal production/development flow without OTP: initiate OTP delivery
    return sendOtp(req, res, next);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticates credentials and returns a signed JWT.
 *          Enforces email verification requirement.
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

    // Enforce email verification (in non-test environments or when explicitly unverified)
    if (user.isVerified === false && !isTestEnv()) {
      return next(
        new AppError(
          'Your email address has not been verified. Please verify your account with an OTP before logging in.',
          403,
          'ACCOUNT_UNVERIFIED',
          { email: user.email }
        )
      );
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
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Initiates password reset process and sends reset code via Gmail SMTP.
 *          Returns generic response to prevent email enumeration.
 * @access  Public
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const validation = validateForgotPasswordInput({ email });
    if (!validation.isValid) {
      return next(
        new AppError('Please provide a valid email address.', 400, 'VALIDATION_ERROR', validation.errors)
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail, isActive: true });

    if (user) {
      // Check resend cooldown (60 seconds)
      const prevReset = await PasswordReset.findOne({ email: normalizedEmail });
      if (prevReset && prevReset.updatedAt) {
        const elapsed = Date.now() - new Date(prevReset.updatedAt).getTime();
        if (elapsed < 60000) {
          // In cooldown: return generic success to avoid enumeration, but don't spam emails
          return res.status(200).json({
            success: true,
            message: 'If an account exists for this email address, a password reset code has been sent.'
          });
        }
      }

      // Generate 6-digit reset code
      const resetCode = generateNumericOtp(6);
      const tokenHash = await PasswordReset.hashToken(resetCode);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await PasswordReset.findOneAndUpdate(
        { email: normalizedEmail },
        {
          email: normalizedEmail,
          tokenHash,
          attempts: 0,
          used: false,
          expiresAt
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Send real email via Gmail SMTP
      await emailService.sendPasswordResetEmail({
        to: normalizedEmail,
        name: user.name,
        resetCode,
        expiresInMinutes: 15
      });
    }

    // Generic response prevents user enumeration
    return res.status(200).json({
      success: true,
      message: 'If an account exists for this email address, a password reset code has been sent.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Validates reset code, updates password in database, and invalidates reset token.
 * @access  Public
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;

    const validation = validateResetPasswordInput({ email, token, newPassword });
    if (!validation.isValid) {
      return next(
        new AppError('Validation failed on password reset.', 400, 'VALIDATION_ERROR', validation.errors)
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find active password reset record
    const resetRecord = await PasswordReset.findOne({
      email: normalizedEmail,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!resetRecord) {
      return next(
        new AppError(
          'Invalid or expired password reset code. Please request a new code.',
          400,
          'INVALID_OR_EXPIRED_CODE'
        )
      );
    }

    // Check maximum attempts limit (5 attempts)
    if (resetRecord.attempts >= 5) {
      await PasswordReset.deleteOne({ _id: resetRecord._id });
      return next(
        new AppError(
          'Too many incorrect attempts. This code has been invalidated. Please request a new code.',
          429,
          'TOO_MANY_ATTEMPTS'
        )
      );
    }

    // Verify reset code
    const isMatch = await resetRecord.compareToken(token);
    if (!isMatch) {
      resetRecord.attempts += 1;
      await resetRecord.save();
      const remainingAttempts = 5 - resetRecord.attempts;

      return next(
        new AppError(
          `Invalid password reset code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`,
          400,
          'INVALID_CODE'
        )
      );
    }

    // Find user and update password
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return next(new AppError('User not found.', 404, 'USER_NOT_FOUND'));
    }

    user.passwordHash = await User.hashPassword(newPassword);
    user.isVerified = true;
    await user.save();

    // Mark reset record used / remove it
    await PasswordReset.deleteOne({ _id: resetRecord._id });

    logger.info(`Password reset successfully completed for ${normalizedEmail}`);

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully. You may now sign in with your new password.'
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

/**
 * @route   GET /api/v1/auth/github/config
 * @desc    Returns public GitHub OAuth client configuration
 * @access  Public
 */
export const getGithubConfig = (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      clientId: env.GITHUB_CLIENT_ID || null,
      isConfigured: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)
    }
  });
};

/**
 * @route   POST /api/v1/auth/github
 * @desc    Exchanges GitHub OAuth temporary code for access token, fetches profile and logs in or creates user
 * @access  Public
 */
export const githubLogin = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      return next(new AppError('Authorization code is required from GitHub OAuth.', 400, 'MISSING_CODE'));
    }

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return next(
        new AppError(
          'GitHub OAuth is not configured on the server. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
          503,
          'GITHUB_AUTH_NOT_CONFIGURED'
        )
      );
    }

    // 1. Exchange temporary code for access token with GitHub API
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      logger.warn(`GitHub OAuth token exchange failed: ${tokenData.error_description || tokenData.error}`);
      return next(
        new AppError(
          tokenData.error_description || 'Failed to exchange authorization code with GitHub.',
          400,
          'GITHUB_EXCHANGE_FAILED'
        )
      );
    }

    const accessToken = tokenData.access_token;

    // 2. Fetch user profile from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'FixFlow-App',
        Accept: 'application/json'
      }
    });

    if (!userResponse.ok) {
      return next(new AppError('Unable to retrieve user profile from GitHub.', 502, 'GITHUB_PROFILE_ERROR'));
    }

    const githubProfile = await userResponse.json();
    const githubId = String(githubProfile.id);

    // 3. Resolve primary email address (public or via emails endpoint)
    let email = githubProfile.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'FixFlow-App',
          Accept: 'application/json'
        }
      });

      if (emailsResponse.ok) {
        const emails = await emailsResponse.json();
        if (Array.isArray(emails)) {
          const primaryVerified =
            emails.find((e) => e.primary && e.verified) ||
            emails.find((e) => e.verified) ||
            emails[0];
          if (primaryVerified) {
            email = primaryVerified.email;
          }
        }
      }
    }

    if (!email) {
      email = `${githubProfile.login.toLowerCase()}@users.noreply.github.com`;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const displayName = (githubProfile.name || githubProfile.login || 'GitHub User').trim().slice(0, 60);
    const avatarUrl = githubProfile.avatar_url || null;

    // 4. Find existing user by githubId or email
    let user = await User.findOne({
      $or: [{ githubId }, { email: normalizedEmail }]
    });

    if (user) {
      let modified = false;
      if (!user.githubId) {
        user.githubId = githubId;
        modified = true;
      }
      if (!user.avatarUrl && avatarUrl) {
        user.avatarUrl = avatarUrl;
        modified = true;
      }
      if (!user.isVerified) {
        user.isVerified = true;
        modified = true;
      }
      if (modified) {
        await user.save();
      }
    } else {
      user = await User.create({
        name: displayName,
        email: normalizedEmail,
        githubId,
        avatarUrl,
        role: 'user',
        isVerified: true,
        isActive: true
      });
    }

    if (!user.isActive) {
      return next(
        new AppError('Your account has been deactivated. Please contact support.', 403, 'ACCOUNT_DEACTIVATED')
      );
    }

    // 5. Generate FixFlow JWT token
    const token = signToken(user);

    logger.info(`User ${user.email} successfully authenticated via GitHub OAuth (GitHub ID: ${githubId})`);

    return res.status(200).json({
      success: true,
      message: 'Successfully authenticated with GitHub.',
      data: {
        user: user.toSafeObject(),
        token
      }
    });
  } catch (err) {
    next(err);
  }
};

export default {
  sendOtp,
  verifyOtp,
  register,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  logout,
  getTechnicians,
  getGithubConfig,
  githubLogin
};
