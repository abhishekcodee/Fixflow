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
import { PlusIcon } from '../components/common/Icons';
import './Complaints.css';

export function ComplaintList() {
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
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
    setSearchQuery('');
    setSortBy('newest');
  };

  // Client-side filtering and sorting for search queries
  const processedComplaints = complaints
    .filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchNum = item.complaintNumber?.toLowerCase().includes(q);
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchLoc = `${item.location?.building} ${item.location?.room}`.toLowerCase().includes(q);
      return matchNum || matchTitle || matchDesc || matchLoc;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      if (sortBy === 'priority') {
        const priorityRank = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
      }
      // default newest
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const hasActiveFilters = Object.values(filters).some(Boolean) || searchQuery.trim().length > 0;

  return (
    <div className="complaints-page">
      <PageHeader
        title="Maintenance Complaints"
        description="Browse, filter, and track facility service requests."
        actions={
          <Link to="/complaints/new">
            <Button variant="primary" size="md" className="btn-with-icon">
              <PlusIcon size={16} />
              <span>Report Incident</span>
            </Button>
          </Link>
        }
      />

      {/* Filter Toolbar */}
      <Card className="filter-card">
        <div className="filter-grid">
          {/* Search Field */}
          <div className="filter-search-field">
            <label htmlFor="complaints-search" className="filter-field-label">
              Search Tickets
            </label>
            <input
              id="complaints-search"
              name="search"
              type="search"
              placeholder="Filter by ticket #, keyword, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-search-input"
            />
          </div>

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

          <Select
            id="filter-sort"
            name="sort"
            label="Sort Order"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={[
              { value: 'newest', label: 'Newest First' },
              { value: 'oldest', label: 'Oldest First' },
              { value: 'priority', label: 'Highest Priority' },
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
                    Report First Issue
                  </Button>
                </Link>
              )
            }
          />
        )}

        {!loading && !error && complaints.length > 0 && processedComplaints.length === 0 && (
          <div className="complaints-no-search-match">
            <p>No complaints match your search query &ldquo;{searchQuery}&rdquo;.</p>
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
              Clear Search Query
            </Button>
          </div>
        )}

        {!loading && !error && processedComplaints.length > 0 && (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Issue Details</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Location</th>
                    <th>Assigned Tech</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {processedComplaints.map((item) => (
                    <tr key={item._id || item.id}>
                      <td className="font-mono">{item.complaintNumber}</td>
                      <td>
                        <div className="complaint-item-details">
                          <span className="font-medium">{item.title}</span>
                          {item.description && (
                            <span className="complaint-item-desc text-muted text-xs">
                              {item.description.length > 70
                                ? `${item.description.slice(0, 70)}...`
                                : item.description}
                            </span>
                          )}
                        </div>
                      </td>
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
                      <td className="text-muted text-xs">
                        {item.location?.building
                          ? `${item.location.building}, ${item.location.room || item.location.roomOrUnit || ''}`
                          : '—'}
                      </td>
                      <td className="text-xs">
                        {item.assignedTo?.name ? (
                          <span className="complaint-tech-assigned">
                            <span aria-hidden="true">👤 </span>
                            <span>{item.assignedTo.name}</span>
                          </span>
                        ) : (
                          <span className="text-muted">Unassigned</span>
                        )}
                      </td>
                      <td className="text-muted text-xs whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <Link to={`/complaints/${item._id || item.id}`}>
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

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="pagination-bar">
                <span className="pagination-info">
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total tickets)
                </span>
                <div className="pagination-buttons">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => loadComplaints(pagination.page - 1)}
                  >
                    ← Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => loadComplaints(pagination.page + 1)}
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
