/**
 * Input validation utilities for Authentication & User workflows.
 */

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates password strength policy:
 * - Minimum 8 characters
 * - Maximum 128 characters
 * - Contains at least one letter and one number
 * @param {string} password
 * @returns {{ isValid: boolean, error?: string }}
 */
export const validatePasswordPolicy = (password) => {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required.' };
  }
  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 128) {
    return { isValid: false, error: 'Password must not exceed 128 characters.' };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one letter and one number.' };
  }
  return { isValid: true };
};

/**
 * Validates registration payload.
 * Strictly ignores or rejects privileged roles.
 * @param {object} data
 * @returns {{ isValid: boolean, errors: Array<{ field: string, issue: string }> }}
 */
export const validateRegistrationInput = ({ name, email, password, role }) => {
  const errors = [];

  // Name validation
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push({ field: 'name', issue: 'Name must be at least 2 characters long.' });
  } else if (name.trim().length > 60) {
    errors.push({ field: 'name', issue: 'Name must not exceed 60 characters.' });
  }

  // Email validation
  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push({ field: 'email', issue: 'Please provide a valid email address.' });
  }

  // Password validation
  const pwdValidation = validatePasswordPolicy(password);
  if (!pwdValidation.isValid) {
    errors.push({ field: 'password', issue: pwdValidation.error });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates login payload.
 * @param {object} data
 * @returns {{ isValid: boolean, errors: Array<{ field: string, issue: string }> }}
 */
export const validateLoginInput = ({ email, password }) => {
  const errors = [];

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push({ field: 'email', issue: 'Email address is required.' });
  }

  if (!password || typeof password !== 'string' || !password) {
    errors.push({ field: 'password', issue: 'Password is required.' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateOtpInput = ({ email, otp }) => {
  const errors = [];

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push({ field: 'email', issue: 'Please provide a valid email address.' });
  }

  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    errors.push({ field: 'otp', issue: 'Verification code must be a 6-digit numeric code.' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateForgotPasswordInput = ({ email }) => {
  const errors = [];

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push({ field: 'email', issue: 'Please provide a valid email address.' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateResetPasswordInput = ({ email, token, newPassword }) => {
  const errors = [];

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push({ field: 'email', issue: 'Please provide a valid email address.' });
  }

  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token.trim())) {
    errors.push({ field: 'token', issue: 'Password reset code must be a 6-digit numeric code.' });
  }

  const pwdValidation = validatePasswordPolicy(newPassword);
  if (!pwdValidation.isValid) {
    errors.push({ field: 'newPassword', issue: pwdValidation.error });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export default {
  validatePasswordPolicy,
  validateRegistrationInput,
  validateLoginInput,
  validateOtpInput,
  validateForgotPasswordInput,
  validateResetPasswordInput
};
