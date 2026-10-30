import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { complaintsApi } from '../services/api';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import {
  PlusIcon,
  ZapIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ComplaintsIcon,
  SearchIcon,
  ArrowRightIcon,
} from '../components/common/Icons';
import { ComplaintsMap } from '../components/common/ComplaintsMap';
import './Dashboard.css';

export function UserDashboard() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [totalReported, setTotalReported] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [geoFilter, setGeoFilter] = useState(null);

  const fetchDashboardData = useCallback(async (isBackground = false, activeGeo = geoFilter) => {
    if (!isBackground) {
      setLoading(true);
      setError(null);
    } else {
      setIsRefreshing(true);
    }
    try {
      const queryParams = { limit: 50 };
      if (activeGeo && activeGeo.lat && activeGeo.lng) {
        queryParams.lat = activeGeo.lat;
        queryParams.lng = activeGeo.lng;
        queryParams.radius = activeGeo.radius;
        queryParams.nearby = 'true';
      }
      const response = await complaintsApi.list(queryParams);
      const items = response?.complaints || [];
      setComplaints(items);
      setTotalReported(response?.pagination?.total || items.length);
    } catch (err) {
      if (!isBackground) {
        setError(err.message || 'Failed to retrieve recent complaints.');
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [geoFilter]);

  useEffect(() => {
    fetchDashboardData();

    // Automatically poll so any complaint submitted shows immediately on the dashboard map!
    const intervalId = setInterval(() => {
      fetchDashboardData(true);
    }, 8000);

    const handleFocus = () => fetchDashboardData(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchDashboardData]);

  // Filter complaints based on tab and search
  const filteredComplaints = complaints.filter((item) => {
    // Tab filter
    if (activeTab === 'in_progress' && !['assigned', 'in_progress', 'on_hold'].includes(item.status)) {
      return false;
    }
    if (activeTab === 'high_urgent' && !['high', 'urgent'].includes(item.priority)) {
      return false;
    }
    if (activeTab === 'resolved' && !['resolved', 'closed'].includes(item.status)) {
      return false;
    }

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchNumber = item.complaintNumber?.toLowerCase().includes(q);
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchLocation = `${item.location?.building} ${item.location?.room}`.toLowerCase().includes(q);
      return matchNumber || matchTitle || matchLocation;
    }

    return true;
  });

  const inProgressCount = complaints.filter((c) => ['assigned', 'in_progress', 'on_hold'].includes(c.status)).length;
  const resolvedCount = complaints.filter((c) => ['resolved', 'closed'].includes(c.status)).length;
  const urgentCount = complaints.filter((c) => ['high', 'urgent'].includes(c.priority)).length;
  const totalCount = totalReported || complaints.length;

  return (
    <div className="dashboard-page">
      <PageHeader
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <span>Welcome back, {user?.name || 'Resident'}</span>
            <StatusBadge status={user?.identityStatus || 'pending'} size="sm" />
          </div>
        }
        description="Monitor campus maintenance requests, technician assignments, and repair telemetry."
        actions={
          <Link to="/complaints/new">
            <Button variant="primary" size="md" className="btn-with-icon">
              <PlusIcon size={16} />
              <span>Report Issue</span>
            </Button>
          </Link>
        }
      />

      {user?.identityStatus !== 'verified' && (
        <div className="identity-notice-banner">
          <span className="identity-notice-icon">🛡️</span>
          <div className="identity-notice-text">
            <strong>Identity Verification:</strong> Your account identity status is currently{' '}
            <span className="capitalize font-bold">{user?.identityStatus || 'pending'}</span>. Complete official verification in{' '}
            <Link to="/settings" className="font-semibold underline">
              Account Settings
            </Link>{' '}
            for priority dispatch and authenticated security badge access.
          </div>
        </div>
      )}

      {/* Metrics Overview Grid (Stitch Spec) */}
      <div className="metrics-grid" role="region" aria-label="Operational Telemetry">
        <Card className="metric-card metric-card--primary">
          <div className="metric-card__header">
            <span className="metric-card__label">Active / In Progress</span>
            <div className="metric-card__icon-badge metric-card__icon-badge--warning" aria-hidden="true">
              <ZapIcon size={18} />
            </div>
          </div>
          <span className="metric-card__value text-warning">{inProgressCount}</span>
          <span className="metric-card__hint">Undergoing triage or technician repair</span>
        </Card>

        <Card className="metric-card metric-card--danger">
          <div className="metric-card__header">
            <span className="metric-card__label">High & Urgent Priority</span>
            <div className="metric-card__icon-badge metric-card__icon-badge--danger" aria-hidden="true">
              <AlertTriangleIcon size={18} />
            </div>
          </div>
          <span className="metric-card__value text-danger">{urgentCount}</span>
          <span className="metric-card__hint">Requires immediate dispatch SLA attention</span>
        </Card>

        <Card className="metric-card metric-card--success">
          <div className="metric-card__header">
            <span className="metric-card__label">Resolved / Closed</span>
            <div className="metric-card__icon-badge metric-card__icon-badge--success" aria-hidden="true">
              <CheckCircleIcon size={18} />
            </div>
          </div>
          <span className="metric-card__value text-success">{resolvedCount}</span>
          <span className="metric-card__hint">Completed maintenance service orders</span>
        </Card>

        <Card className="metric-card metric-card--neutral">
          <div className="metric-card__header">
            <span className="metric-card__label">Recent Reported</span>
            <div className="metric-card__icon-badge metric-card__icon-badge--neutral" aria-hidden="true">
              <ComplaintsIcon size={18} />
            </div>
          </div>
          <span className="metric-card__value">{totalCount}</span>
          <span className="metric-card__hint">Total complaints logged in recent window</span>
        </Card>
      </div>

      {/* Real-time Interactive Facility Incidents Map (Uber-style GPS & Service Radius) */}
      <ComplaintsMap
        complaints={complaints}
        onRefresh={() => fetchDashboardData(false)}
        isRefreshing={isRefreshing}
        userRole={user?.role}
        onNearbySearch={(coords, radius) => {
          const nextGeo = { lat: coords.lat, lng: coords.lng, radius };
          setGeoFilter(nextGeo);
          fetchDashboardData(true, nextGeo);
        }}
      />

      {/* Recent Activity Section */}
      <Card
        title="Recent Complaints"
        subtitle="Your latest logged maintenance incidents"
        action={
          <Link to="/complaints" className="dashboard-view-all">
            <span>View All ({totalCount})</span>
            <ArrowRightIcon size={14} />
          </Link>
        }
        className="recent-complaints-card"
      >
        {/* Triage Tabs & Quick Search */}
        <div className="dashboard-toolbar">
          <div className="dashboard-tabs" role="tablist" aria-label="Complaint Filters">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'all'}
              className={`dashboard-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All ({complaints.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'in_progress'}
              className={`dashboard-tab ${activeTab === 'in_progress' ? 'active' : ''}`}
              onClick={() => setActiveTab('in_progress')}
            >
              In Progress ({inProgressCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'high_urgent'}
              className={`dashboard-tab ${activeTab === 'high_urgent' ? 'active' : ''}`}
              onClick={() => setActiveTab('high_urgent')}
            >
              High / Urgent ({urgentCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'resolved'}
              className={`dashboard-tab ${activeTab === 'resolved' ? 'active' : ''}`}
              onClick={() => setActiveTab('resolved')}
            >
              Resolved ({resolvedCount})
            </button>
          </div>

          <div className="dashboard-search">
            <SearchIcon size={16} className="dashboard-search__icon" />
            <input
              id="dashboard-search-input"
              name="dashboardSearch"
              type="search"
              placeholder="Search by ticket #, title, or room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="dashboard-search__input"
              aria-label="Filter recent complaints"
            />
          </div>
        </div>

        {loading && <LoadingState message="Fetching your recent maintenance tickets..." />}

        {!loading && error && (
          <ErrorState
            title="Failed to Load Complaints"
            message={error}
            onRetry={fetchDashboardData}
          />
        )}

        {!loading && !error && complaints.length === 0 && (
          <EmptyState
            title="No complaints reported yet"
            description="All systems in your workspace appear operational. If something needs repair or attention, submit an incident report."
            action={
              <Link to="/complaints/new">
                <Button variant="primary" size="sm">
                  Create First Complaint
                </Button>
              </Link>
            }
          />
        )}

        {!loading && !error && complaints.length > 0 && filteredComplaints.length === 0 && (
          <div className="dashboard-no-filter-match">
            <p>No complaints match the current tab or search criteria.</p>
            <button
              type="button"
              className="auth-card__link"
              onClick={() => {
                setActiveTab('all');
                setSearchTerm('');
              }}
            >
              Reset filters
            </button>
          </div>
        )}

        {!loading && !error && filteredComplaints.length > 0 && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned Specialist</th>
                  <th>Location</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.slice(0, 10).map((item) => (
                  <tr key={item._id || item.id}>
                    <td className="font-mono">{item.complaintNumber}</td>
                    <td className="font-medium">{item.title}</td>
                    <td className="capitalize">
                      <span className={`cat-pill cat-pill--${item.category}`}>
                        {item.category?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <StatusBadge priority={item.priority} variant="priority" />
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      {item.assignedTo ? (
                        <div className="assigned-tech-cell">
                          <span className="font-semibold text-xs text-primary">
                            🔧 {item.assignedTo.name}
                          </span>
                          {item.assignedTo.technicianProfile?.primarySpecialization && (
                            <span className="text-xs text-muted block capitalize">
                              ({item.assignedTo.technicianProfile.primarySpecialization})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted text-xs">Awaiting Dispatch</span>
                      )}
                    </td>
                    <td className="text-muted text-xs">
                      {item.location?.building ? `${item.location.building}, ${item.location.room}` : '—'}
                    </td>
                    <td className="text-muted text-xs">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <Link to={`/complaints/${item._id || item.id}`}>
                        <Button variant="secondary" size="sm">
                          Details
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
