import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { complaintsApi } from '../services/api';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Select } from '../components/common/Select';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import './Complaints.css';

export function ComplaintList() {
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadComplaints(page = 1) {
    setLoading(true);
    setError(null);
    try {
      const response = await complaintsApi.list({
        page,
        limit: pagination.limit,
        status: filters.status,
        category: filters.category,
        priority: filters.priority,
      });

      setComplaints(response?.complaints || []);
      if (response?.pagination) {
        setPagination(response.pagination);
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve complaints.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComplaints(1);
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({ status: '', category: '', priority: '' });
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="complaints-page">
      <PageHeader
        title="Maintenance Complaints"
        description="Browse, filter, and track facility service requests."
        actions={
          <Link to="/complaints/new">
            <Button variant="primary" size="md">
              ➕ Report Incident
            </Button>
          </Link>
        }
      />

      {/* Filter Toolbar */}
      <Card className="filter-card">
        <div className="filter-grid">
          <Select
            id="filter-status"
            name="status"
            label="Status"
            placeholder="All Statuses"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'submitted', label: 'Submitted' },
              { value: 'assigned', label: 'Assigned' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'on_hold', label: 'On Hold' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />

          <Select
            id="filter-category"
            name="category"
            label="Category"
            placeholder="All Categories"
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            options={[
              { value: '', label: 'All Categories' },
              { value: 'electrical', label: 'Electrical' },
              { value: 'plumbing', label: 'Plumbing' },
              { value: 'hvac', label: 'HVAC / Climate' },
              { value: 'carpentry', label: 'Carpentry' },
              { value: 'appliance', label: 'Appliance' },
              { value: 'safety_security', label: 'Safety & Security' },
              { value: 'cleaning', label: 'Cleaning' },
              { value: 'other', label: 'Other' },
            ]}
          />

          <Select
            id="filter-priority"
            name="priority"
            label="Priority"
            placeholder="All Priorities"
            value={filters.priority}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            options={[
              { value: '', label: 'All Priorities' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />

          {hasActiveFilters && (
            <div className="filter-reset-wrapper">
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Table & List View */}
      <Card className="table-card">
        {loading && <LoadingState message="Loading complaints..." />}

        {!loading && error && (
          <ErrorState
            title="Failed to Load Complaints"
            message={error}
            onRetry={() => loadComplaints(pagination.page)}
          />
        )}

        {!loading && !error && complaints.length === 0 && (
          <EmptyState
            title={hasActiveFilters ? 'No matching complaints' : 'No complaints recorded'}
            description={
              hasActiveFilters
                ? 'Try broadening your filter criteria or clearing active filters.'
                : 'No maintenance complaints have been reported yet in your scope.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                  Clear All Filters
                </Button>
              ) : (
                <Link to="/complaints/new">
                  <Button variant="primary" size="sm">
                    Report Issue
                  </Button>
                </Link>
              )
            }
          />
        )}

        {!loading && !error && complaints.length > 0 && (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Reported</th>
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
                        {item.assignedTo ? item.assignedTo.name : 'Unassigned'}
                      </td>
                      <td className="text-muted text-xs">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <Link to={`/complaints/${item._id}`}>
                          <Button variant="secondary" size="sm">
                            Inspect
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="pagination-bar">
              <span className="pagination-summary">
                Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages || 1}</strong> ({pagination.total} total)
              </span>

              <div className="pagination-buttons">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => loadComplaints(pagination.page - 1)}
                >
                  ◀ Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadComplaints(pagination.page + 1)}
                >
                  Next ▶
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
