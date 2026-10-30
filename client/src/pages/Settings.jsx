import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { StatusBadge } from '../components/common/StatusBadge';
import { ErrorState } from '../components/common/ErrorState';
import { SettingsIcon, TrashIcon, ShieldAlertIcon } from '../components/common/Icons';
import { AadhaarVerificationCard } from '../components/common/AadhaarVerificationCard';
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
            Manage your personal profile, role permissions, identity credentials, and data privacy options.
          </p>
        </div>
      </header>

      {successMessage && (
        <div className="settings-alert settings-alert--success">
          <p>{successMessage}</p>
        </div>
      )}

      {error && !showModal && (
        <div className="settings-alert settings-alert--error">
          <ErrorState title="Error" message={error} />
        </div>
      )}

      <div className="settings-content">
        {/* Profile Details Card */}
        <Card
          className="settings-card"
          title="Profile Information"
          subtitle="Your personal identification and FixFlow account role"
        >
          <div className="settings-profile-grid">
            <div className="settings-profile-item">
              <span className="settings-label">Full Name</span>
              <span className="settings-value">{user?.name || '—'}</span>
            </div>

            <div className="settings-profile-item">
              <span className="settings-label">Email Address</span>
              <span className="settings-value">{user?.email || '—'}</span>
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
                <StatusBadge status={user?.isActive ? 'active' : 'suspended'} />
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

        {/* Identity Verification Card (Aadhaar & Document Vault) */}
        <AadhaarVerificationCard
          initialStatus={user?.identityStatus}
          onStatusChange={(newStatus) => {
            if (updateUser) {
              updateUser({
                ...user,
                identityStatus: newStatus.toLowerCase(),
              });
            }
          }}
        />

        {/* Danger Zone Card */}
        <Card
          className="settings-card settings-card--danger"
          title="Danger Zone"
          subtitle="Permanent account deletion and privacy management"
        >
          <div className="danger-zone-content">
            <div className="danger-zone-info">
              <div className="danger-zone-icon">
                <ShieldAlertIcon size={24} />
              </div>
              <div className="danger-zone-text">
                <h4 className="danger-zone-heading">Delete This Account</h4>
                <p className="danger-zone-description">
                  Permanently delete your user profile and active credentials. Existing maintenance complaints and work order histories are anonymized for institutional audit retention.
                </p>
              </div>
            </div>

            <div className="danger-zone-actions">
              <Button
                variant="danger"
                size="md"
                onClick={handleOpenModal}
                className="btn-with-icon"
              >
                <TrashIcon size={16} />
                <span>Delete My Account</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Account Deletion Confirmation Modal */}
      {showModal && (
        <div className="settings-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="settings-modal-card">
            <div className="settings-modal-header">
              <div className="settings-modal-header-icon">
                <ShieldAlertIcon size={28} />
              </div>
              <div>
                <h3 id="modal-title" className="settings-modal-title">Delete Account Confirmation</h3>
                <p className="settings-modal-subtitle">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <div className="settings-modal-body">
              <div className="settings-warning-box">
                <h5 className="settings-warning-title">Important Retention Notice:</h5>
                <ul className="settings-warning-list">
                  <li>Your user login and personal credentials will be permanently erased.</li>
                  <li>Historical facilities maintenance tickets submitted by you will be anonymized to maintain operational integrity.</li>
                  <li>You will immediately be logged out of FixFlow.</li>
                </ul>
              </div>

              {error && (
                <div className="settings-modal-error">
                  <ErrorState title="Action Required" message={error} />
                </div>
              )}

              <form onSubmit={handleDeleteAccount} className="settings-delete-form">
                <div className="form-group">
                  <label htmlFor="delete-confirmation-input" className="input-label">
                    Type <strong>DELETE</strong> in all-caps to confirm:
                  </label>
                  <Input
                    id="delete-confirmation-input"
                    name="confirmationText"
                    type="text"
                    placeholder="DELETE"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="delete-password-input" className="input-label">
                    Confirm your current password:
                  </label>
                  <Input
                    id="delete-password-input"
                    name="password"
                    type="password"
                    placeholder="Enter current password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="settings-modal-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleCloseModal}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    size="md"
                    isLoading={isDeleting}
                    loadingText="Deleting Account..."
                  >
                    Permanently Delete Account
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
