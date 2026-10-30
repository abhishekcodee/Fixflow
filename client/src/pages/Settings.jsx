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
  const { user, logout } = useAuth();
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
