import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { ErrorState } from '../components/common/ErrorState';
import './Auth.css';

export function ForgotPassword() {
  const [step, setStep] = useState(1); // 1 = Request Code, 2 = Enter Code & Reset Password, 3 = Success
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const [expiresIn, setExpiresIn] = useState(900); // 15 minutes
  const [resendCooldown, setResendCooldown] = useState(60);
  const [remainingAttempts, setRemainingAttempts] = useState(null);

  const codeInputRef = useRef(null);
  const navigate = useNavigate();

  // Password rules
  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  useEffect(() => {
    let interval = null;
    if (step === 2) {
      interval = setInterval(() => {
        setExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step]);

  useEffect(() => {
    if (step === 2 && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [step]);

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // STEP 1: Request Reset Code
  async function handleRequestCode(e) {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});

    if (!email.trim()) {
      setFieldErrors({ email: 'Please enter your registered email address.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldErrors({ email: 'Please enter a valid email address.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.forgotPassword({ email: email.trim() });
      setStep(2);
      setToken('');
      setExpiresIn(900);
      setResendCooldown(60);
      setRemainingAttempts(null);
      setInfoMessage(
        res.message ||
          'If an account exists with this email address, a 6-digit reset code has been dispatched.'
      );
    } catch (err) {
      setFormError(
        err.message || 'Failed to dispatch password reset email. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // RESEND RESET CODE
  async function handleResendCode() {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setFormError('');
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setExpiresIn(900);
      setResendCooldown(60);
      setRemainingAttempts(null);
      setInfoMessage('A fresh password reset code has been dispatched.');
    } catch (err) {
      setFormError(err.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  }

  // STEP 2: Submit Reset Code & New Password
  async function handleResetPassword(e) {
    e.preventDefault();
    setFormError('');
    const errors = {};

    const cleanToken = token.trim().replace(/\s+/g, '');
    if (!cleanToken || cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
      errors.token = 'Please enter the 6-digit numeric reset code.';
    }

    if (!newPassword) {
      errors.newPassword = 'New password is required.';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters.';
    } else if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      errors.newPassword = 'Password must include at least one letter and one number.';
    }

    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await authApi.resetPassword({
        email: email.trim(),
        token: cleanToken,
        newPassword,
      });

      setStep(3); // Success state
    } catch (err) {
      if (err.details?.attemptsRemaining !== undefined) {
        setRemainingAttempts(err.details.attemptsRemaining);
      }
      setFormError(err.message || 'Password reset failed. Please check the code.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card-wrapper">
        <div className="auth-brand">
          <div className="auth-brand__logo" aria-hidden="true">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <h1 className="auth-brand__title">FixFlow</h1>
          <p className="auth-brand__tagline">Enterprise Facilities Care & Incident Management</p>
        </div>

        <Card className="auth-card">
          <div className="auth-card__header">
            <h2 className="auth-card__heading">
              {step === 1
                ? 'Forgot Password'
                : step === 2
                ? 'Reset Password'
                : 'Password Reset Complete'}
            </h2>
            <p className="auth-card__subheading">
              {step === 1
                ? 'Enter your registered email address to receive a secure 6-digit recovery code.'
                : step === 2
                ? `Enter the recovery code sent to ${email} and choose your new password.`
                : 'Your password has been securely updated. You can now sign in.'}
            </p>
          </div>

          {infoMessage && step !== 3 && (
            <div className="auth-info-banner" role="status">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>{infoMessage}</span>
            </div>
          )}

          {formError && (
            <div className="auth-card__alert">
              <ErrorState title="Password Reset Error" message={formError} />
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleRequestCode} noValidate>
              <Input
                id="forgot-email"
                name="email"
                type="email"
                label="Email Address"
                placeholder="name@organization.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
                autoComplete="email"
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                loadingText="Sending Recovery Code..."
                className="auth-card__submit-btn"
              >
                Send Recovery Code
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleResetPassword} noValidate>
              <div className="auth-otp-input-container">
                <label htmlFor="reset-code" className="input-label">
                  6-Digit Recovery Code
                </label>
                <input
                  ref={codeInputRef}
                  id="reset-code"
                  name="token"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={token}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setToken(val);
                  }}
                  placeholder="000000"
                  className="auth-otp-input"
                  required
                />
                {fieldErrors.token && <p className="field-error">{fieldErrors.token}</p>}
              </div>

              <div className="auth-otp-meta-row">
                <span
                  className={`auth-timer-badge ${
                    expiresIn <= 120 ? 'auth-timer-badge--warning' : ''
                  }`}
                >
                  ⏱ Code valid for: {formatTime(expiresIn)}
                </span>

                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || isResending}
                  className="auth-resend-btn"
                >
                  {isResending
                    ? 'Resending...'
                    : resendCooldown > 0
                    ? `Resend (${resendCooldown}s)`
                    : 'Resend Code'}
                </button>
              </div>

              {remainingAttempts !== null && remainingAttempts > 0 && (
                <p className="field-error" style={{ marginBottom: '12px' }}>
                  {remainingAttempts} attempt{remainingAttempts > 1 ? 's' : ''} remaining.
                </p>
              )}

              <Input
                id="reset-new-password"
                name="newPassword"
                type="password"
                label="New Password"
                placeholder="Min. 8 characters with letter & number"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={fieldErrors.newPassword}
                autoComplete="new-password"
                showPasswordToggle={true}
                required
              />

              {newPassword.length > 0 && (
                <div className="auth-password-hints" aria-live="polite">
                  <span className={`hint-item ${hasMinLength ? 'hint-item--valid' : ''}`}>
                    {hasMinLength ? '✓' : '•'} At least 8 characters
                  </span>
                  <span className={`hint-item ${hasLetter ? 'hint-item--valid' : ''}`}>
                    {hasLetter ? '✓' : '•'} At least one letter
                  </span>
                  <span className={`hint-item ${hasNumber ? 'hint-item--valid' : ''}`}>
                    {hasNumber ? '✓' : '•'} At least one number
                  </span>
                </div>
              )}

              <Input
                id="reset-confirm-password"
                name="confirmPassword"
                type="password"
                label="Confirm New Password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={fieldErrors.confirmPassword}
                autoComplete="new-password"
                showPasswordToggle={true}
                required
              />

              {confirmPassword.length > 0 && (
                <div className="auth-password-hints" aria-live="polite">
                  <span className={`hint-item ${passwordsMatch ? 'hint-item--valid' : ''}`}>
                    {passwordsMatch ? '✓ Passwords match' : '• Passwords must match'}
                  </span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                loadingText="Updating Password..."
                disabled={token.length !== 6 || expiresIn <= 0}
                className="auth-card__submit-btn"
              >
                Reset Password
              </Button>

              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setFormError('');
                    setInfoMessage('');
                  }}
                  className="auth-back-link-btn"
                >
                  ← Enter a different email
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
                Your account password has been successfully reset. You can now use your new credentials to sign in.
              </p>
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => navigate('/login')}
                className="auth-card__submit-btn"
              >
                Proceed to Sign In
              </Button>
            </div>
          )}

          <div className="auth-card__footer">
            <p className="auth-card__switch-text">
              Remember your password?{' '}
              <Link to="/login" className="auth-card__link">
                Back to Sign In
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
