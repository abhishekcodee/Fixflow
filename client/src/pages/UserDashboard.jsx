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
import './Dashboard.css';

export function UserDashboard() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchDashboardData() {
    setLoading(true);
    setError(null);
    try {
      const response = await complaintsApi.list({ limit: 5 });
      setComplaints(response?.complaints || []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve recent complaints.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const totalCount = complaints.length;
  const inProgressCount = complaints.filter((c) => ['assigned', 'in_progress', 'on_hold'].includes(c.status)).length;
  const resolvedCount = complaints.filter((c) => ['resolved', 'closed'].includes(c.status)).length;

  return (
    <div className="dashboard-page">
      <PageHeader
        title={`Welcome back, ${user?.name || 'User'}`}
        description="Monitor maintenance requests, technician assignments, and repair progress."
        actions={
          <Link to="/complaints/new">
            <Button variant="primary" size="md">
              ➕ Report Issue
            </Button>
          </Link>
        }
      />

      {/* Metrics Overview Grid */}
      <div className="metrics-grid">
        <Card className="metric-card">
          <span className="metric-card__label">Active / In Progress</span>
          <span className="metric-card__value text-warning">{inProgressCount}</span>
          <span className="metric-card__hint">Jobs undergoing inspection or repair</span>
        </Card>

        <Card className="metric-card">
          <span className="metric-card__label">Resolved / Closed</span>
          <span className="metric-card__value text-success">{resolvedCount}</span>
          <span className="metric-card__hint">Completed maintenance requests</span>
        </Card>

        <Card className="metric-card">
          <span className="metric-card__label">Recent Reported</span>
          <span className="metric-card__value">{totalCount}</span>
          <span className="metric-card__hint">Total complaints logged in recent window</span>
        </Card>
      </div>

      {/* Recent Activity Section */}
      <Card
        title="Recent Complaints"
        subtitle="Your latest logged maintenance incidents"
        action={
          <Link to="/complaints" className="dashboard-view-all">
            View All ({totalCount}) →
          </Link>
        }
        className="recent-complaints-card"
      >
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

        {!loading && !error && complaints.length > 0 && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((item) => (
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
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <Link to={`/complaints/${item._id}`}>
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
