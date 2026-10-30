import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { complaintsApi, techniciansApi } from '../services/api';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { RefreshIcon, WrenchIcon } from '../components/common/Icons';
import { ComplaintsMap } from '../components/common/ComplaintsMap';
import './TechnicianDashboard.css';

export function TechnicianDashboard() {
  const { user } = useAuth();
  const isTechnician = user?.role === 'technician' || user?.role === 'admin';

  const [workOrders, setWorkOrders] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  async function loadProfile() {
    setProfileLoading(true);
    try {
      const res = await techniciansApi.getMe();
      if (res?.profile) {
        setProfile(res.profile);
      }
    } catch {
      // Profile might not exist yet if admin
    } finally {
      setProfileLoading(false);
    }
  }

  async function loadWorkOrders(isBackground = false) {
    if (!isBackground) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await complaintsApi.list({ limit: 50 });
      setWorkOrders(response?.complaints || []);
    } catch (err) {
      if (!isBackground) {
        setError(err.message || 'Unable to retrieve assigned work orders.');
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (isTechnician) {
      loadProfile();
      loadWorkOrders();

      const intervalId = setInterval(() => {
        loadWorkOrders(true);
      }, 8000);

      const handleFocus = () => loadWorkOrders(true);
      window.addEventListener('focus', handleFocus);

      return () => {
        clearInterval(intervalId);
        window.removeEventListener('focus', handleFocus);
      };
    } else {
      setLoading(false);
    }
  }, [isTechnician]);

  async function handleToggleAvailability() {
    if (!profile) return;
    setTogglingAvailability(true);
    try {
      const updated = await techniciansApi.toggleAvailability();
      setProfile((prev) => ({
        ...prev,
        isAvailable: updated?.profile?.isAvailable ?? !prev.isAvailable,
      }));
    } catch (err) {
      alert(err.message || 'Failed to update availability');
    } finally {
      setTogglingAvailability(false);
    }
  }

  async function handleQuickStatusUpdate(complaintId, nextStatus) {
    setActionLoadingId(complaintId);
    try {
      await complaintsApi.updateStatus(complaintId, {
        status: nextStatus,
        comment: `Technician updated status to ${nextStatus.replace('_', ' ')} from quick dispatch console.`,
      });
      await loadWorkOrders(true);
    } catch (err) {
      alert(err.message || 'Failed to update ticket status');
    } finally {
      setActionLoadingId(null);
    }
  }

  if (!isTechnician) {
    return (
      <div className="tech-page">
        <PageHeader
          title="Technician Work Queue"
          description="Assigned repair tickets and on-site maintenance tasks."
        />
        <Card className="tech-unauthorized-card">
          <ErrorState
            title="Technician Privileges Required"
            message="This queue is reserved for assigned maintenance technicians and facility managers."
          />
          <div className="tech-unauthorized-actions">
            <Link to="/dashboard">
              <Button variant="secondary" size="md">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const inProgressOrders = workOrders.filter((w) => w.status === 'in_progress');
  const assignedOrders = workOrders.filter((w) => w.status === 'assigned');
  const onHoldOrders = workOrders.filter((w) => w.status === 'on_hold');
  const resolvedOrders = workOrders.filter((w) => ['resolved', 'closed'].includes(w.status));

  const filteredOrders = workOrders.filter((w) => {
    if (activeTab === 'in_progress') return w.status === 'in_progress';
    if (activeTab === 'assigned') return w.status === 'assigned';
    if (activeTab === 'on_hold') return w.status === 'on_hold';
    if (activeTab === 'resolved') return ['resolved', 'closed'].includes(w.status);
    return true;
  });

  return (
    <div className="tech-page">
      <PageHeader
        title="Technician Work Queue"
        description="Manage assigned work orders, update job execution states, and log repair resolutions."
        actions={
          <Button variant="secondary" size="sm" onClick={() => loadWorkOrders(false)} className="btn-with-icon">
            <RefreshIcon size={14} />
            <span>Refresh Work Orders</span>
          </Button>
        }
      />

      {/* Technician Profile & Dispatch Status Card */}
      {profile && (
        <Card className="tech-profile-card">
          <div className="tech-profile-header">
            <div className="tech-profile-details">
              <div className="tech-avatar-circle">
                {user?.name?.charAt(0)?.toUpperCase() || 'T'}
              </div>
              <div className="tech-info-col">
                <div className="tech-name-row">
                  <h3 className="tech-name">{user?.name}</h3>
                  <StatusBadge status={user?.identityStatus || 'pending'} size="sm" />
                  <StatusBadge status={profile.approvalStatus || 'pending_approval'} size="sm" />
                </div>
                <div className="tech-specs-row">
                  <span className="tech-primary-spec">
                    🔧 {profile.primarySpecialization?.toUpperCase() || 'GENERAL'}
                    {profile.customSpecialization ? ` (${profile.customSpecialization})` : ''}
                  </span>
                  {profile.experienceYears !== null && profile.experienceYears !== undefined && (
                    <span className="tech-spec-tag">⭐ {profile.experienceYears} Years Experience</span>
                  )}
                  {profile.serviceArea && (
                    <span className="tech-spec-tag">📍 Zone: {profile.serviceArea}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="tech-availability-controls">
              <div className="availability-status-label">
                <span className="tech-metric-card__label">Dispatch Status:</span>
                <span className={`availability-text ${profile.isAvailable ? 'text-success' : 'text-muted'}`}>
                  {profile.isAvailable ? '🟢 Online & Ready' : '⚪ Offline / Resting'}
                </span>
              </div>
              <Button
                variant={profile.isAvailable ? 'secondary' : 'primary'}
                size="sm"
                onClick={handleToggleAvailability}
                isLoading={togglingAvailability}
              >
                {profile.isAvailable ? 'Switch to Offline' : 'Go Available Online'}
              </Button>
            </div>
          </div>

          {profile.approvalStatus !== 'approved' && (
            <div className="tech-approval-banner">
              ⚠️ <strong>Account Verification in Progress:</strong> Your profile is currently{' '}
              <span className="capitalize font-bold">{profile.approvalStatus?.replace('_', ' ')}</span>. You will be matched to automatic work orders as soon as campus administration finalizes verification.
            </div>
          )}
        </Card>
      )}

      {/* Technician Metric Summary */}
      <div className="tech-metrics-grid">
        <Card className="tech-metric-card" onClick={() => setActiveTab('in_progress')}>
          <span className="tech-metric-card__label">Active (In Progress)</span>
          <span className="tech-metric-card__value text-warning">{inProgressOrders.length}</span>
        </Card>
        <Card className="tech-metric-card" onClick={() => setActiveTab('assigned')}>
          <span className="tech-metric-card__label">Awaiting Start (Assigned)</span>
          <span className="tech-metric-card__value">{assignedOrders.length}</span>
        </Card>
        <Card className="tech-metric-card" onClick={() => setActiveTab('on_hold')}>
          <span className="tech-metric-card__label">On Hold</span>
          <span className="tech-metric-card__value">{onHoldOrders.length}</span>
        </Card>
        <Card className="tech-metric-card" onClick={() => setActiveTab('resolved')}>
          <span className="tech-metric-card__label">Completed (Resolved)</span>
          <span className="tech-metric-card__value text-success">{resolvedOrders.length}</span>
        </Card>
      </div>

      {/* Real-time Technician Work Orders Navigation Map */}
      <ComplaintsMap
        complaints={workOrders}
        title="Assigned Work Orders Navigation Map"
        subtitle="Geographic building and floor locations for your assigned maintenance service tickets"
        onRefresh={() => loadWorkOrders(false)}
        userRole={user?.role}
      />

      {/* Active Work Orders Table with Status Tabs */}
      <Card
        title="Assigned Work Orders"
        subtitle="Current work order queue under your assignment"
        className="tech-queue-card"
      >
        <div className="tech-tabs-bar">
          <button
            type="button"
            className={`tech-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Orders ({workOrders.length})
          </button>
          <button
            type="button"
            className={`tech-tab-btn ${activeTab === 'assigned' ? 'active' : ''}`}
            onClick={() => setActiveTab('assigned')}
          >
            Assigned ({assignedOrders.length})
          </button>
          <button
            type="button"
            className={`tech-tab-btn ${activeTab === 'in_progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('in_progress')}
          >
            In Progress ({inProgressOrders.length})
          </button>
          <button
            type="button"
            className={`tech-tab-btn ${activeTab === 'on_hold' ? 'active' : ''}`}
            onClick={() => setActiveTab('on_hold')}
          >
            On Hold ({onHoldOrders.length})
          </button>
          <button
            type="button"
            className={`tech-tab-btn ${activeTab === 'resolved' ? 'active' : ''}`}
            onClick={() => setActiveTab('resolved')}
          >
            Resolved ({resolvedOrders.length})
          </button>
        </div>

        {loading && <LoadingState message="Fetching assigned work orders..." />}

        {!loading && error && (
          <ErrorState
            title="Work Queue Unavailable"
            message={error}
            onRetry={loadWorkOrders}
          />
        )}

        {!loading && !error && filteredOrders.length === 0 && (
          <EmptyState
            title="No matching work orders"
            description="You currently have no maintenance complaints in this status category."
            icon={<WrenchIcon size={32} />}
          />
        )}

        {!loading && !error && filteredOrders.length > 0 && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Quick Actions</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((item) => (
                  <tr key={item._id}>
                    <td className="font-mono">{item.complaintNumber}</td>
                    <td className="font-medium">{item.title}</td>
                    <td className="capitalize">{item.category?.replace('_', ' ')}</td>
                    <td>
                      <StatusBadge priority={item.priority} variant="priority" />
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="text-muted text-xs">
                      {item.location?.building}, Fl {item.location?.floor}, Unit {item.location?.roomOrUnit || item.location?.room}
                    </td>
                    <td>
                      <div className="tech-quick-actions">
                        {item.status === 'assigned' && (
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={actionLoadingId === item._id}
                            onClick={() => handleQuickStatusUpdate(item._id, 'in_progress')}
                          >
                            Start Work
                          </Button>
                        )}
                        {item.status === 'in_progress' && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              isLoading={actionLoadingId === item._id}
                              onClick={() => handleQuickStatusUpdate(item._id, 'on_hold')}
                            >
                              Hold
                            </Button>
                            <Button
                              variant="success"
                              size="sm"
                              isLoading={actionLoadingId === item._id}
                              onClick={() => handleQuickStatusUpdate(item._id, 'resolved')}
                            >
                              Resolve
                            </Button>
                          </>
                        )}
                        {item.status === 'on_hold' && (
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={actionLoadingId === item._id}
                            onClick={() => handleQuickStatusUpdate(item._id, 'in_progress')}
                          >
                            Resume
                          </Button>
                        )}
                        {['resolved', 'closed'].includes(item.status) && (
                          <span className="text-xs text-muted">Completed</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <Link to={`/complaints/${item._id}`}>
                        <Button variant="ghost" size="sm">
                          Inspect
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
