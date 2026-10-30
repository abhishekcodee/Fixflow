import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { StatusBadge } from '../components/common/StatusBadge';
import { ErrorState } from '../components/common/ErrorState';
import { SettingsIcon, TrashIcon, ShieldAlertIcon } from '../components/common/Icons';
import { authApi } from '../services/api';
import './Settings.css';

export function Settings() {
  const { user, logout, updateUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Identity Verification (Aadhaar) State
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [isSubmittingAadhaar, setIsSubmittingAadhaar] = useState(false);
  const [aadhaarError, setAadhaarError] = useState('');
  const [aadhaarSuccess, setAadhaarSuccess] = useState('');

  const handleVerifyAadhaar = async (e) => {
    e.preventDefault();
    setAadhaarError('');
    setAadhaarSuccess('');

    const clean = aadhaarInput.replace(/[\s-]/g, '');
    if (clean.length !== 12 || !/^[2-9]\d{11}$/.test(clean)) {
      setAadhaarError('Please enter a valid 12-digit Aadhaar number starting with 2-9.');
      return;
    }

    setIsSubmittingAadhaar(true);
    try {
      const res = await authApi.verifyIdentity({ aadhaarNumber: clean });
      setAadhaarSuccess(res.message || 'Identity verification submitted successfully.');
      setAadhaarInput('');
      if (updateUser && res.data?.user) {
        updateUser(res.data.user);
      }
    } catch (err) {
      setAadhaarError(err.message || 'Failed to submit identity verification.');
    } finally {
      setIsSubmittingAadhaar(false);
    }
  };

  const handleOpenModal = () => {
    setError('');
    setConfirmationText('');
    setPassword('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (isDeleting) return;
    setShowModal(false);
    setError('');
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setError('');

    if (confirmationText.trim() !== 'DELETE') {
      setError('Please type DELETE exactly in uppercase to confirm.');
      return;
    }

    setIsDeleting(true);
    try {
      const res = await authApi.deleteAccount({
        password: password || undefined,
        confirmation: 'DELETE'
      });

      setSuccessMessage(res?.message || 'Your account has been deleted successfully. You will be redirected shortly.');
      setTimeout(async () => {
        await logout();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="page-header">
        <div className="page-header__content">
          <div className="settings-title-row">
            <span className="settings-header-icon" aria-hidden="true">
              <SettingsIcon size={24} />
            </span>
            <h1 className="page-header__title">Account Settings</h1>
          </div>
          <p className="page-header__description">
            Manage your personal profile information, system roles, and account security.
          </p>
        </div>
      </header>

      {successMessage && (
        <div className="settings-alert settings-alert--success" role="alert">
          <strong>Account Deletion Scheduled:</strong> {successMessage}
        </div>
      )}

      {error && !showModal && (
        <ErrorState title="Settings Error" message={error} onRetry={() => setError('')} />
      )}

      <div className="settings-grid">
        {/* Profile Card */}
        <Card
          className="settings-card"
          title="Profile Information"
          subtitle="Your current identity and contact information in FixFlow"
        >
          <div className="settings-profile-list">
            <div className="settings-profile-item">
              <span className="settings-label">Full Name</span>
              <span className="settings-value">{user?.name || 'Not provided'}</span>
            </div>
            <div className="settings-profile-item">
              <span className="settings-label">Registered Email</span>
              <span className="settings-value">{user?.email || 'Not provided'}</span>
            </div>
            <div className="settings-profile-item">
              <span className="settings-label">Mobile Number</span>
              <span className="settings-value">{user?.phone || 'Not registered'}</span>
            </div>
            <div className="settings-profile-item">
              <span className="settings-label">Account Role</span>
              <span className="settings-value">
                <StatusBadge status={user?.role || 'user'} />
              </span>
            </div>
            <div className="settings-profile-item">
              <span className="settings-label">Account Status</span>
              <span className="settings-value">
                <span className="settings-status-pill settings-status-pill--active">Active</span>
              </span>
            </div>
            {user?.role === 'technician' && user?.technicianProfile && (
              <>
                <div className="settings-profile-item">
                  <span className="settings-label">Technician Specialization</span>
                  <span className="settings-value" style={{ textTransform: 'capitalize', fontWeight: '600' }}>
                    {user.technicianProfile.primarySpecialization}
                  </span>
                </div>
                <div className="settings-profile-item">
                  <span className="settings-label">Approval Status</span>
                  <span className="settings-value">
                    <StatusBadge status={user.technicianProfile.approvalStatus} />
                  </span>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Identity Verification Card (Aadhaar) */}
        <Card
          className="settings-card"
          title="Identity Verification (Aadhaar)"
          subtitle="Government-compliant identity verification and verified trust badges"
        >
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Current Verification Status: </span>
                <StatusBadge status={user?.identityStatus || 'unverified'} />
              </div>
              {user?.identityNumberMasked && (
                <div style={{ fontFamily: 'monospace', fontWeight: '600', color: '#1e3a8a', background: '#eff6ff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '13px' }}>
                  Masked ID: {user.identityNumberMasked}
                </div>
              )}
            </div>

            {aadhaarSuccess && (
              <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', color: '#166534', fontSize: '13px', marginBottom: '14px' }}>
                ✓ {aadhaarSuccess}
              </div>
            )}

            {aadhaarError && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', fontSize: '13px', marginBottom: '14px' }}>
                ⚠ {aadhaarError}
              </div>
            )}

            {user?.identityStatus !== 'verified' ? (
              <form onSubmit={handleVerifyAadhaar} style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                  {user?.identityStatus === 'pending'
                    ? 'Your identity verification is currently queued/pending administrative verification. You may re-submit with an updated 12-digit number below if needed:'
                    : 'Submit your 12-digit Aadhaar number to obtain a verified identity badge. Number is securely hashed and masked; plaintext is never stored or exposed.'}
                </p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1', minWidth: '220px' }}>
                    <Input
                      id="settings-aadhaar-input"
                      name="aadhaar"
                      type="text"
                      placeholder="e.g. 5412 7890 1234"
                      value={aadhaarInput}
                      onChange={(e) => setAadhaarInput(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSubmittingAadhaar}
                    loadingText="Verifying..."
                  >
                    Submit Verification
                  </Button>
                </div>
              </form>
            ) : (
              <div style={{ padding: '14px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span style={{ fontSize: '13px', color: '#166534', fontWeight: '500' }}>
                  Your identity has been verified. Verified members receive prioritized maintenance dispatch and organizational access.
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Danger Zone Card */}
        <Card
          className="settings-card settings-card--danger"
          title="Danger Zone"
          subtitle="Permanent account deletion and privacy management"
        >
          <div className="danger-zone-content">
              <div className="danger-zone-info">
                <div className="danger-zone-icon" aria-hidden="true">
                  <ShieldAlertIcon size={22} />
                </div>
                <div>
                  <h4 className="danger-zone-title">Delete Account</h4>
                  <p className="danger-zone-desc">
                    Once you delete your account, your personal details (name, email, mobile number, and password) will be permanently anonymized and purged. 
                    Historical incident reports, maintenance tickets, and work order audits you submitted will be securely preserved for campus compliance and operational accountability.
                  </p>
                </div>
              </div>

              <div className="danger-zone-actions">
                <Button
                  variant="danger"
                  onClick={handleOpenModal}
                  className="btn-with-icon"
                  id="delete-account-trigger"
                >
                  <TrashIcon size={16} />
                  <span>Delete My Account</span>
                </Button>
              </div>
            </div>
        </Card>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="settings-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="settings-modal">
            <div className="settings-modal__header">
              <div className="settings-modal__icon-wrap">
                <TrashIcon size={22} className="danger-icon" />
              </div>
              <div>
                <h3 id="modal-title" className="settings-modal__title">Delete Account Confirmation</h3>
                <p className="settings-modal__subtitle">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <form onSubmit={handleDeleteAccount} className="settings-modal__body">
              {error && (
                <div className="settings-alert settings-alert--error" role="alert">
                  {error}
                </div>
              )}

              <div className="settings-modal__notice">
                <p>
                  <strong>Retention &amp; Anonymization Policy:</strong>
                </p>
                <ul>
                  <li>Your login credentials and personal records will be immediately purged.</li>
                  <li>You will be logged out and cannot sign in again with this account.</li>
                  <li>Campus maintenance tickets and complaint audit logs remain intact for operational tracking.</li>
                </ul>
              </div>

              {user?.passwordHash && (
                <div className="settings-modal__field">
                  <Input
                    label="Current Password"
                    type="password"
                    id="delete-confirm-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your current password"
                    required
                  />
                </div>
              )}

              <div className="settings-modal__field">
                <label htmlFor="delete-confirm-text" className="input-label">
                  To confirm, type <strong>DELETE</strong> below:
                </label>
                <Input
                  id="delete-confirm-text"
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="settings-modal__footer">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseModal}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  isLoading={isDeleting}
                  loadingText="Deleting Account..."
                  disabled={confirmationText.trim() !== 'DELETE'}
                  id="confirm-delete-button"
                >
                  I Understand, Delete My Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
