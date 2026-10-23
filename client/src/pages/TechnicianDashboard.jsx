import { useState, useEffect } from 'react';
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
import './TechnicianDashboard.css';

export function TechnicianDashboard() {
  const { user } = useAuth();
  const isTechnician = user?.role === 'technician' || user?.role === 'admin';

  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadWorkOrders() {
    setLoading(true);
    setError(null);
    try {
      const response = await complaintsApi.list({ limit: 50 });
      setWorkOrders(response?.complaints || []);
    } catch (err) {
      setError(err.message || 'Unable to retrieve assigned work orders.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isTechnician) {
      loadWorkOrders();
    } else {
      setLoading(false);
    }
  }, [isTechnician]);

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

  return (
    <div className="tech-page">
      <PageHeader
        title="Technician Work Queue"
        description="Manage assigned work orders, update job execution states, and log repair resolutions."
        actions={
          <Button variant="secondary" size="sm" onClick={loadWorkOrders}>
            ↻ Refresh Work Orders
          </Button>
        }
      />

      {/* Technician Metric Summary */}
      <div className="tech-metrics-grid">
        <Card className="tech-metric-card">
          <span className="tech-metric-card__label">Active (In Progress)</span>
          <span className="tech-metric-card__value text-warning">{inProgressOrders.length}</span>
        </Card>
        <Card className="tech-metric-card">
          <span className="tech-metric-card__label">Awaiting Start (Assigned)</span>
          <span className="tech-metric-card__value">{assignedOrders.length}</span>
        </Card>
        <Card className="tech-metric-card">
          <span className="tech-metric-card__label">On Hold</span>
          <span className="tech-metric-card__value">{onHoldOrders.length}</span>
        </Card>
        <Card className="tech-metric-card">
          <span className="tech-metric-card__label">Completed (Resolved)</span>
          <span className="tech-metric-card__value text-success">{resolvedOrders.length}</span>
        </Card>
      </div>

      {/* Active Work Orders Table */}
      <Card
        title="Assigned Work Orders"
        subtitle="Current work order queue under your assignment"
        className="tech-queue-card"
      >
        {loading && <LoadingState message="Fetching assigned work orders..." />}

        {!loading && error && (
          <ErrorState
            title="Work Queue Unavailable"
            message={error}
            onRetry={loadWorkOrders}
          />
        )}

        {!loading && !error && workOrders.length === 0 && (
          <EmptyState
            title="No work orders assigned"
            description="You currently have no maintenance complaints assigned to your technician profile."
            icon="🛠️"
          />
        )}

        {!loading && !error && workOrders.length > 0 && (
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((item) => (
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
                      {item.location?.building}, Fl {item.location?.floor}, Unit {item.location?.roomOrUnit}
                    </td>
                    <td>
                      <Link to={`/complaints/${item._id}`}>
                        <Button variant="primary" size="sm">
                          Inspect & Update
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
