import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { complaintsApi, authApi } from '../services/api';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Textarea } from '../components/common/Textarea';
import './AdminDashboard.css';

export function AdminDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [unassignedComplaints, setUnassignedComplaints] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Assign modal state
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [technicianId, setTechnicianId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [useManualId, setUseManualId] = useState(false);

  async function loadTriageData() {
    setLoading(true);
    setError(null);
    try {
      const [complaintsRes, techRes] = await Promise.all([
        complaintsApi.list({ status: 'submitted', limit: 25 }),
        authApi.getTechnicians().catch(() => ({ technicians: [] })),
      ]);

      setUnassignedComplaints(complaintsRes?.complaints || []);
      setTechnicians(techRes?.technicians || []);
    } catch (err) {
      setError(err.message || 'Unable to retrieve unassigned complaints.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadTriageData();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  function openAssignModal(complaint) {
    setSelectedTicket(complaint);
    setTechnicianId(technicians.length > 0 ? technicians[0]._id : '');
    setAssignNote('');
    setAssignError('');
    setUseManualId(technicians.length === 0);
  }

  async function handleAssignSubmit(e) {
    e.preventDefault();
    setAssignError('');

    if (!technicianId.trim()) {
      setAssignError('Please select or enter a valid technician ID.');
      return;
    }

    setAssignSubmitting(true);
    try {
      await complaintsApi.assign(selectedTicket._id, {
        technicianId: technicianId.trim(),
        note: assignNote.trim() || undefined,
      });
      setSelectedTicket(null);
      await loadTriageData();
    } catch (err) {
      setAssignError(err.message || 'Failed to assign technician.');
    } finally {
      setAssignSubmitting(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <PageHeader
          title="Admin Dispatch Console"
          description="Operational triage and technician assignment tools."
        />
        <Card className="unauthorized-card">
          <ErrorState
            title="Administrator Access Required"
            message="Your account currently possesses standard or technician privileges. Administrative access is restricted to facilities dispatchers and managers."
          />
          <div className="unauthorized-actions">
            <Link to="/dashboard">
              <Button variant="secondary" size="md">
                Return to Personal Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeader
        title="Admin Dispatch Console"
        description="Review incoming incident submissions and dispatch work orders to maintenance technicians."
        actions={
          <Button variant="secondary" size="sm" onClick={loadTriageData}>
            ↻ Refresh Queue
          </Button>
        }
      />

      <Card
        title="Incoming Triage Queue (Submitted)"
        subtitle="Unassigned complaints requiring evaluation and technician assignment"
        className="admin-triage-card"
      >
        {loading && <LoadingState message="Scanning incoming ticket queue..." />}

        {!loading && error && (
          <ErrorState
            title="Triage Queue Unavailable"
            message={error}
            onRetry={loadTriageData}
          />
        )}

        {!loading && !error && unassignedComplaints.length === 0 && (
          <EmptyState
            title="Queue is clear!"
            description="All submitted maintenance complaints have been triaged or dispatched to technicians."
            icon="🎉"
          />
        )}

        {!loading && !error && unassignedComplaints.length > 0 && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Location</th>
                  <th>Reported By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {unassignedComplaints.map((item) => (
                  <tr key={item._id}>
                    <td className="font-mono">{item.complaintNumber}</td>
                    <td className="font-medium">{item.title}</td>
                    <td className="capitalize">{item.category?.replace('_', ' ')}</td>
                    <td>
                      <StatusBadge priority={item.priority} variant="priority" />
                    </td>
                    <td className="text-muted text-xs">
                      {item.location?.building}, Fl {item.location?.floor}
                    </td>
                    <td className="text-muted text-xs">
                      {item.createdBy?.name || 'Requester'}
                    </td>
                    <td>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openAssignModal(item)}
                      >
                        ⚡ Dispatch
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Technician Assignment Modal */}
      <Modal
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title={`Dispatch Ticket: ${selectedTicket?.complaintNumber}`}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setSelectedTicket(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={assignSubmitting}
              loadingText="Assigning..."
              onClick={handleAssignSubmit}
            >
              Confirm Assignment
            </Button>
          </>
        }
      >
        <form onSubmit={handleAssignSubmit}>
          {assignError && (
            <div className="assign-modal-alert">
              <ErrorState title="Assignment Failed" message={assignError} />
            </div>
          )}

          <p className="assign-ticket-meta">
            Title: <strong>{selectedTicket?.title}</strong> ({selectedTicket?.category})
          </p>

          {!useManualId && technicians.length > 0 ? (
            <div className="technician-picker-group">
              <Select
                id="assign-tech-select"
                name="technicianId"
                label="Assign to Active Technician"
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                options={technicians.map((t) => ({
                  value: t._id,
                  label: `${t.name} (${t.email})`,
                }))}
                required
              />
              <button
                type="button"
                className="btn-link-subtle"
                onClick={() => setUseManualId(true)}
              >
                Or enter technician ObjectId manually
              </button>
            </div>
          ) : (
            <div className="technician-picker-group">
              <Input
                id="assign-tech-id"
                name="technicianId"
                label="Technician User ObjectId"
                placeholder="e.g. 651a7b8e4f1c9a0011223344"
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                helperText="24-character hexadecimal MongoDB ObjectId of an active technician."
                required
              />
              {technicians.length > 0 ? (
                <button
                  type="button"
                  className="btn-link-subtle"
                  onClick={() => setUseManualId(false)}
                >
                  ← Select from active technicians dropdown
                </button>
              ) : (
                <p className="no-tech-notice">
                  No active technicians found. You can enter a technician ObjectId manually or register a technician user.
                </p>
              )}
            </div>
          )}

          <Textarea
            id="assign-note"
            name="note"
            label="Dispatch Instructions / Note"
            placeholder="Optional instructions for the technician regarding tools or urgent access..."
            value={assignNote}
            onChange={(e) => setAssignNote(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
}
