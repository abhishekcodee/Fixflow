import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { ErrorState } from '../components/common/ErrorState';
import './Auth.css';

const TECHNICIAN_SPECIALIZATION_OPTIONS = [
  { value: 'electrician', label: 'Electrician' },
  { value: 'plumber', label: 'Plumber' },
  { value: 'hvac', label: 'HVAC / AC Technician' },
  { value: 'carpenter', label: 'Carpenter' },
  { value: 'painter', label: 'Painter' },
  { value: 'civil', label: 'Civil Maintenance Technician' },
  { value: 'appliance', label: 'Appliance Repair Technician' },
  { value: 'elevator', label: 'Lift / Elevator Technician' },
  { value: 'fire_safety', label: 'Fire Safety Technician' },
  { value: 'network', label: 'IT / Network Technician' },
  { value: 'general', label: 'General Maintenance Technician' },
  { value: 'other', label: 'Other (Specify Below)' }
];

export function Register() {
  // Step: 1 = Enter Info & Send OTP, 2 = Verify OTP & Create Account
  const [step, setStep] = useState(1);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user'); // 'user' or 'technician'
  const [specialization, setSpecialization] = useState('electrician');
  const [customSpecialization, setCustomSpecialization] = useState('');
  const [experienceYears, setExperienceYears] = useState('2');
  const [serviceArea, setServiceArea] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [otp, setOtp] = useState('');

  // Status & Feedback States
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Timers
  const [otpExpiresIn, setOtpExpiresIn] = useState(300); // 5 minutes (300s)
  const [resendCooldown, setResendCooldown] = useState(60); // 60s cooldown
  const [remainingAttempts, setRemainingAttempts] = useState(null);

  const { setSession } = useAuth();
  const navigate = useNavigate();
  const otpInputRef = useRef(null);

  // Password requirements checklist
  const hasMinLength = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // Active timers for OTP expiration and resend cooldown
  useEffect(() => {
    let timer = null;
    if (step === 2) {
      timer = setInterval(() => {
        setOtpExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step]);

  // Focus OTP input upon transitioning to step 2
  useEffect(() => {
    if (step === 2 && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function validateStep1() {
    const errors = {};

    if (!name.trim()) {
      errors.name = 'Full name is required.';
    } else if (name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters long.';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please provide a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      errors.password = 'Password must contain at least one letter and one number.';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (role === 'technician') {
      if (specialization === 'other' && !customSpecialization.trim()) {
        errors.customSpecialization = 'Please specify your technician specialization.';
      }
    }

    if (aadhaarNumber.trim()) {
      const cleanAadhaar = aadhaarNumber.replace(/[\s-]/g, '');
      if (cleanAadhaar.length !== 12 || !/^[2-9]\d{11}$/.test(cleanAadhaar)) {
        errors.aadhaarNumber = 'Aadhaar must be a 12-digit number starting with 2-9.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // STEP 1 -> Send OTP via Gmail SMTP
  async function handleSendOtp(e) {
    if (e) e.preventDefault();
    setFormError('');
    setInfoMessage('');

    if (!validateStep1()) return;

    setIsSubmitting(true);
    try {
      const response = await authApi.sendOtp({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        specialization: role === 'technician' ? specialization : undefined,
        primarySpecialization: role === 'technician' ? specialization : undefined,
        customSpecialization: role === 'technician' && specialization === 'other' ? customSpecialization.trim() : undefined,
        experienceYears: role === 'technician' ? parseInt(experienceYears || '0', 10) : undefined,
        serviceArea: role === 'technician' && serviceArea.trim() ? serviceArea.trim() : undefined,
        aadhaarNumber: aadhaarNumber.trim() ? aadhaarNumber.trim() : undefined,
      });

      setStep(2);
      setOtpExpiresIn(300); // 5 minutes
      setResendCooldown(60); // 60s cooldown
      setRemainingAttempts(null);
      setOtp('');
      setInfoMessage(
        `A 6-digit verification code has been dispatched to ${email.trim()}. Please check your email inbox and enter the code below.`
      );
    } catch (err) {
      setFormError(
        err.message ||
        'Failed to send verification code. Please verify your connection or SMTP settings.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // RESEND OTP
  async function handleResendOtp() {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setFormError('');
    try {
      await authApi.sendOtp({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      });

      setOtpExpiresIn(300);
      setResendCooldown(60);
      setRemainingAttempts(null);
      setOtp('');
      setInfoMessage(`A fresh verification code was sent to ${email.trim()}. Please check your email inbox.`);
    } catch (err) {
      setFormError(err.message || 'Failed to resend verification code.');
    } finally {
      setIsResending(false);
    }
  }

  // STEP 2 -> Verify OTP and Create Database Account
  async function handleVerifyOtp(e) {
    e.preventDefault();
    setFormError('');

    const cleanOtp = otp.trim().replace(/\s+/g, '');
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setFormError('Please enter the complete 6-digit numeric verification code.');
      return;
    }

    if (otpExpiresIn <= 0) {
      setFormError('The verification code has expired. Please request a new code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authApi.verifyOtp({
        email: email.trim(),
        otp: cleanOtp,
      });

      if (response?.token && response?.user) {
        setSession(response.token, response.user);
        const destination = response.user.role === 'technician' ? '/technician' : '/dashboard';
        navigate(destination, { replace: true });
      } else {
        throw new Error('Registration completed but session could not be established.');
      }
    } catch (err) {
      if (err.details?.attemptsRemaining !== undefined) {
        setRemainingAttempts(err.details.attemptsRemaining);
      }
      setFormError(err.message || 'Verification failed. Please check the code and try again.');
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
          {/* Step Indicator */}
          <div className="auth-steps" aria-label="Registration Progress">
            <div className={`auth-step-pill ${step === 1 ? 'auth-step-pill--active' : ''}`}>
              <span className="auth-step-pill__num">1</span> Account Details
            </div>
            <div className={`auth-step-pill ${step === 2 ? 'auth-step-pill--active' : ''}`}>
              <span className="auth-step-pill__num">2</span> Email OTP Verification
            </div>
          </div>

          <div className="auth-card__header">
            <h2 className="auth-card__heading">
              {step === 1 ? 'Create Account' : 'Verify Email Address'}
            </h2>
            <p className="auth-card__subheading">
              {step === 1
                ? 'Register to report issues, track repairs, and manage facilities.'
                : `Enter the 6-digit verification code dispatched to ${email}.`}
            </p>
          </div>

          {infoMessage && (
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
              <ErrorState title="Registration Error" message={formError} />
            </div>
          )}

          {step === 1 ? (
            /* STEP 1: Registration Form */
            <form onSubmit={handleSendOtp} noValidate>
              {/* Account Role Selection: Resident/User or Technician */}
              <div className="auth-role-group">
                <label className="input-label" htmlFor="register-role">
                  Account Type <span className="input-required" aria-hidden="true">*</span>
                </label>
                <div className="auth-role-cards" role="radiogroup" aria-label="Account Type">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={role === 'user'}
                    className={`auth-role-card ${role === 'user' ? 'auth-role-card--active' : ''}`}
                    onClick={() => setRole('user')}
                    id="register-role-user"
                  >
                    <div className="auth-role-card__header">
                      <div className="auth-role-card__icon" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className="auth-role-card__title-row">
                        <span className="auth-role-card__title">Resident / User</span>
                        {role === 'user' && <span className="auth-role-card__badge">Selected</span>}
                      </div>
                    </div>
                    <p className="auth-role-card__desc">
                      Report facility complaints, track repairs, and view campus incident map.
                    </p>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={role === 'technician'}
                    className={`auth-role-card ${role === 'technician' ? 'auth-role-card--active' : ''}`}
                    onClick={() => setRole('technician')}
                    id="register-role-technician"
                  >
                    <div className="auth-role-card__header">
                      <div className="auth-role-card__icon" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                        </svg>
                      </div>
                      <div className="auth-role-card__title-row">
                        <span className="auth-role-card__title">Technician</span>
                        {role === 'technician' && <span className="auth-role-card__badge">Selected</span>}
                      </div>
                    </div>
                    <p className="auth-role-card__desc">
                      Receive assigned work orders, navigate facility incident map, and log repairs.
                    </p>
                  </button>
                </div>

                <select
                  id="register-role"
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="sr-only"
                  aria-label="Account Type"
                >
                  <option value="user">Resident / User</option>
                  <option value="technician">Technician</option>
                </select>
              </div>

              <Input
                id="register-name"
                name="name"
                type="text"
                label="Full Name"
                placeholder="e.g. Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={fieldErrors.name}
                autoComplete="name"
                required
              />

              <Input
                id="register-email"
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

              <Input
                id="register-password"
                name="password"
                type="password"
                label="Password"
                placeholder="Min. 8 characters with letter & number"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
                autoComplete="new-password"
                showPasswordToggle={true}
                required
              />

              {password.length > 0 && (
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
                id="register-confirm-password"
                name="confirmPassword"
                type="password"
                label="Confirm Password"
                placeholder="Re-enter your password"
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

              {/* Technician Specialization Step */}
              {role === 'technician' && (
                <div className="auth-technician-section" style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                      Technician Specialization
                    </h4>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                      What type of technician are you? FixFlow automatically routes matched maintenance complaints to your queue.
                    </p>
                  </div>

                  <Select
                    id="register-specialization"
                    name="specialization"
                    label="What type of technician are you?"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    options={TECHNICIAN_SPECIALIZATION_OPTIONS}
                    required
                  />

                  {specialization === 'other' && (
                    <div style={{ marginTop: '12px' }}>
                      <Input
                        id="register-custom-specialization"
                        name="customSpecialization"
                        type="text"
                        label="Specify Your Skill"
                        placeholder="e.g. Solar Inverter Specialist"
                        value={customSpecialization}
                        onChange={(e) => setCustomSpecialization(e.target.value)}
                        error={fieldErrors.customSpecialization}
                        required
                      />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                    <Input
                      id="register-experience"
                      name="experienceYears"
                      type="number"
                      min="0"
                      max="50"
                      label="Years of Experience"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                    />
                    <Input
                      id="register-service-area"
                      name="serviceArea"
                      type="text"
                      label="Service Area / Zone"
                      placeholder="e.g. Campus Zone A"
                      value={serviceArea}
                      onChange={(e) => setServiceArea(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Identity Verification Section (Aadhaar) */}
              <div className="auth-identity-section" style={{ marginTop: '16px', padding: '16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af' }}>
                    Identity Verification (Aadhaar)
                  </span>
                </div>
                <Input
                  id="register-aadhaar"
                  name="aadhaarNumber"
                  type="text"
                  label="12-Digit Aadhaar Number"
                  placeholder="e.g. 5412 7890 1234 (Optional during registration)"
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value)}
                  error={fieldErrors.aadhaarNumber}
                  helperText="Your Aadhaar is securely masked (XXXX-XXXX-1234) and hashed before verification; plaintext is never stored or exposed."
                />
                {aadhaarNumber.replace(/[\s-]/g, '').length === 12 && (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#166534', fontWeight: '500' }}>
                    ✓ Masked Display: XXXX-XXXX-{aadhaarNumber.replace(/[\s-]/g, '').slice(-4)}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                loadingText="Sending Verification Code..."
                className="auth-card__submit-btn"
              >
                Send Verification Code
              </Button>
            </form>
          ) : (
            /* STEP 2: OTP Verification Form */
            <form onSubmit={handleVerifyOtp} noValidate>
              <div className="auth-otp-input-container">
                <label htmlFor="register-otp" className="input-label">
                  6-Digit Verification Code
                </label>
                <input
                  ref={otpInputRef}
                  id="register-otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(val);
                  }}
                  placeholder="000000"
                  className="auth-otp-input"
                  required
                />
              </div>

              <div className="auth-otp-meta-row">
                <span
                  className={`auth-timer-badge ${otpExpiresIn <= 60 ? 'auth-timer-badge--warning' : ''
                    }`}
                >
                  ⏱ Expires in: {formatTime(otpExpiresIn)}
                </span>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isResending}
                  className="auth-resend-btn"
                >
                  {isResending
                    ? 'Resending...'
                    : resendCooldown > 0
                      ? `Resend Code (${resendCooldown}s)`
                      : 'Resend Code'}
                </button>
              </div>

              {remainingAttempts !== null && remainingAttempts > 0 && (
                <p className="field-error" style={{ marginBottom: '12px' }}>
                  {remainingAttempts} attempt{remainingAttempts > 1 ? 's' : ''} remaining.
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                loadingText="Verifying & Creating Account..."
                disabled={otp.length !== 6 || otpExpiresIn <= 0}
                className="auth-card__submit-btn"
              >
                Verify & Create Account
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
                  ← Edit registration details
                </button>
              </div>
            </form>
          )}

          <div className="auth-card__footer">
            <p className="auth-card__switch-text">
              Already have an account?{' '}
              <Link to="/login" className="auth-card__link">
                Sign In
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
