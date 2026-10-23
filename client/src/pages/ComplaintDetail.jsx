import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { complaintsApi, authApi } from '../services/api';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { Modal } from '../components/common/Modal';
import { Select } from '../components/common/Select';
import { Textarea } from '../components/common/Textarea';
import './ComplaintDetail.css';

export function ComplaintDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [complaint, setComplaint] = useState(null);
  const [history, setHistory] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status transition modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');

  // Admin dispatch modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Priority update state
  const [updatingPriority, setUpdatingPriority] = useState(false);

  // Feedback state
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState('');

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const promises = [
        complaintsApi.getById(id),
        complaintsApi.getHistory(id).catch(() => ({ history: [] })),
      ];

      if (isAdmin) {
        promises.push(authApi.getTechnicians().catch(() => ({ technicians: [] })));
      }

      const results = await Promise.all(promises);
      setComplaint(results[0]?.complaint);
      setHistory(results[1]?.history || []);
      if (isAdmin && results[2]?.technicians) {
        setTechnicians(results[2].technicians);
      }
    } catch (err) {
      setError(err.message || 'Unable to retrieve complaint details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  function openStatusModal(newStatus) {
    setTargetStatus(newStatus);
    setStatusNote('');
    setStatusError('');
    setModalOpen(true);
  }

  async function handleStatusSubmit(e) {
    e.preventDefault();
    setStatusError('');

    // Require notes for on_hold, resolved, rejected, and reopen
    if (['on_hold', 'resolved', 'rejected'].includes(targetStatus) && !statusNote.trim()) {
      setStatusError('A justification or resolution note is required for this action.');
      return;
    }

    setSubmittingStatus(true);
    try {
      await complaintsApi.updateStatus(id, {
        status: targetStatus,
        note: statusNote.trim() || undefined,
      });
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setStatusError(err.message || 'Failed to update status.');
    } finally {
      setSubmittingStatus(false);
    }
  }

  function openAssignModal() {
    setSelectedTechId(technicians.length > 0 ? technicians[0]._id : '');
    setAssignNote('');
    setAssignError('');
    setAssignModalOpen(true);
  }

  async function handleAssignSubmit(e) {
    e.preventDefault();
    setAssignError('');

    if (!selectedTechId.trim()) {
      setAssignError('Please select or specify a technician.');
      return;
    }

    setSubmittingAssign(true);
    try {
      await complaintsApi.assign(id, {
        technicianId: selectedTechId.trim(),
        note: assignNote.trim() || undefined,
      });
      setAssignModalOpen(false);
      await loadData();
    } catch (err) {
      setAssignError(err.message || 'Failed to dispatch technician.');
    } finally {
      setSubmittingAssign(false);
    }
  }

  async function handlePriorityChange(newPriority) {
    if (newPriority === complaint.priority) return;
    setUpdatingPriority(true);
    try {
      await complaintsApi.update(id, { priority: newPriority });
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to calibrate priority.');
    } finally {
      setUpdatingPriority(false);
    }
  }

  async function handleFeedbackSubmit(e) {
    e.preventDefault();
    setFeedbackError('');
    setFeedbackSuccess('');
    setSubmittingFeedback(true);
    try {
      await complaintsApi.submitFeedback(complaint._id, {
        rating: Number(feedbackRating),
        comments: feedbackComments.trim() || undefined,
      });
      setFeedbackSuccess('Thank you! Your feedback and resolution rating have been recorded.');
      await loadData();
    } catch (err) {
      setFeedbackError(err.message || 'Failed to submit feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  }

  if (loading) {
    return <LoadingState message="Retrieving complaint details and history..." />;
  }

  if (error || !complaint) {
    return (
      <div className="complaint-detail-error">
        <ErrorState
          title="Complaint Unavailable"
          message={error || 'The requested complaint could not be found or you do not have permission to inspect it.'}
          onRetry={loadData}
        />
        <div className="back-link-wrapper">
          <Link to="/complaints">
            <Button variant="secondary" size="sm">
              ← Return to Complaints List
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isAssignedTech = complaint.assignedTo?._id === user?.id;
  const isCreator = complaint.createdBy?._id === user?.id;

  return (
    <div className="complaint-detail-page">
      <PageHeader
        breadcrumbs={<Link to="/complaints">← Back to Complaints</Link>}
        title={`${complaint.complaintNumber}: ${complaint.title}`}
        description={`Reported on ${new Date(complaint.createdAt).toLocaleString()} by ${complaint.createdBy?.name || 'Requester'}`}
        actions={
          <div className="detail-header-badges">
            <StatusBadge priority={complaint.priority} variant="priority" />
            <StatusBadge status={complaint.status} />
          </div>
        }
      />

      <div className="complaint-detail-grid">
        {/* Left Column: Information & Description */}
        <div className="detail-primary-column">
          <Card title="Incident Details" className="detail-section-card">
            <div className="detail-metadata-grid">
              <div className="metadata-item">
                <span className="metadata-label">Category</span>
                <span className="metadata-value capitalize">
                  {complaint.category?.replace('_', ' ')}
                </span>
              </div>

              <div className="metadata-item">
                <span className="metadata-label">Priority Level</span>
                {isAdmin ? (
                  <div className="admin-priority-select-wrapper">
                    <select
                      className="admin-priority-select"
                      value={complaint.priority}
                      disabled={updatingPriority}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                      aria-label="Calibrate Priority (Admin)"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                ) : (
                  <span className="metadata-value capitalize">{complaint.priority}</span>
                )}
              </div>

              <div className="metadata-item">
                <span className="metadata-label">Building / Facility</span>
                <span className="metadata-value">{complaint.location?.building || 'Main'}</span>
              </div>

              <div className="metadata-item">
                <span className="metadata-label">Floor / Unit</span>
                <span className="metadata-value">
                  Floor {complaint.location?.floor}, Unit {complaint.location?.roomOrUnit}
                </span>
              </div>

              {complaint.location?.additionalNotes && (
                <div className="metadata-item full-width">
                  <span className="metadata-label">Location Instructions</span>
                  <span className="metadata-value">{complaint.location.additionalNotes}</span>
                </div>
              )}
            </div>

            <div className="detail-description-block">
              <h4 className="detail-description-heading">Description</h4>
              <p className="detail-description-text">{complaint.description}</p>
            </div>
          </Card>

          {/* Activity History Audit Trail */}
          <Card title="Activity History & Audit Trail" className="detail-section-card">
            {history.length === 0 ? (
              <p className="no-history-text">No previous timeline events recorded.</p>
            ) : (
              <ul className="timeline">
                {history.map((event) => (
                  <li key={event._id} className="timeline-item">
                    <div className="timeline-marker" aria-hidden="true" />
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-actor">
                          {event.performedBy?.name || 'System Operator'}
                        </span>
                        <span className="timeline-time">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="timeline-action">
                        Action: <strong>{event.action.replace('_', ' ')}</strong>
                        {event.previousState && event.newState && (
                          <span className="timeline-state-change">
                            {' '}({event.previousState} ➔ {event.newState})
                          </span>
                        )}
                      </p>
                      {event.note && <p className="timeline-note">"{event.note}"</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Right Column: Workflow Actions & Assignment */}
        <div className="detail-sidebar-column">
          <Card title="Technician Assignment" className="detail-section-card">
            {complaint.assignedTo ? (
              <div className="assigned-tech-info">
                <div className="tech-avatar" aria-hidden="true">
                  {complaint.assignedTo.name?.charAt(0).toUpperCase()}
                </div>
                <div className="tech-meta">
                  <span className="tech-name">{complaint.assignedTo.name}</span>
                  <span className="tech-email">{complaint.assignedTo.email}</span>
                  <span className="tech-badge">Assigned Technician</span>
                </div>
              </div>
            ) : (
              <div className="unassigned-notice">
                <p className="unassigned-text">No technician assigned yet.</p>
                {isAdmin && complaint.status === 'submitted' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={openAssignModal}
                    className="dispatch-detail-btn"
                  >
                    ⚡ Dispatch Technician
                  </Button>
                )}
                {isAdmin && complaint.status !== 'submitted' && (
                  <p className="unassigned-hint">Ticket was unassigned or closed.</p>
                )}
              </div>
            )}
          </Card>

          {/* Workflow Transitions Box */}
          <Card title="Workflow Actions" className="detail-section-card">
            <div className="workflow-actions-wrapper">
              {/* Technician transitions */}
              {(isAssignedTech || isAdmin) && complaint.status === 'assigned' && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => openStatusModal('in_progress')}
                >
                  ▶ Start Work (In Progress)
                </Button>
              )}

              {(isAssignedTech || isAdmin) && complaint.status === 'in_progress' && (
                <>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => openStatusModal('resolved')}
                  >
                    ✔ Mark Resolved
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => openStatusModal('on_hold')}
                  >
                    ⏸ Put On Hold
                  </Button>
                </>
              )}

              {(isAssignedTech || isAdmin) && complaint.status === 'on_hold' && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => openStatusModal('in_progress')}
                >
                  ▶ Resume Work
                </Button>
              )}

              {/* Creator confirmation & reopen */}
              {(isCreator || isAdmin) && complaint.status === 'resolved' && (
                <>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => openStatusModal('closed')}
                  >
                    🔒 Confirm & Close Ticket
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => openStatusModal('in_progress')}
                  >
                    ↺ Reopen Ticket
                  </Button>
                </>
              )}

              {/* Admin direct reject */}
              {isAdmin && complaint.status === 'submitted' && (
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => openStatusModal('rejected')}
                >
                  ✕ Reject Complaint
                </Button>
              )}

              {['closed', 'rejected'].includes(complaint.status) && (
                <p className="terminal-state-text">
                  This complaint is in a terminal status ({complaint.status}). No additional routine workflow transitions are available.
                </p>
              )}
            </div>
          </Card>

          {/* User Feedback & Service Rating Card */}
          {['resolved', 'closed'].includes(complaint.status) && (
            <Card
              title="Resolution Feedback & Rating"
              subtitle="Quality audit and service satisfaction verification"
              className="detail-section-card feedback-section-card"
            >
              {complaint.feedback && complaint.feedback.rating ? (
                <div className="feedback-display">
                  <div className="feedback-stars" aria-label={`Rating: ${complaint.feedback.rating} out of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`star-icon ${star <= complaint.feedback.rating ? 'star-icon--filled' : 'star-icon--empty'}`}
                      >
                        ★
                      </span>
                    ))}
                    <span className="rating-numeric">({complaint.feedback.rating} / 5)</span>
                  </div>
                  {complaint.feedback.comments && (
                    <blockquote className="feedback-quote">
                      "{complaint.feedback.comments}"
                    </blockquote>
                  )}
                  {complaint.feedback.submittedAt && (
                    <span className="feedback-timestamp">
                      Submitted on {new Date(complaint.feedback.submittedAt).toLocaleDateString()}
                    </span>
                  )}
                  <span className="feedback-status-badge">✔ Service Verified</span>
                </div>
              ) : isCreator ? (
                <form onSubmit={handleFeedbackSubmit} className="feedback-form">
                  {feedbackError && (
                    <div className="feedback-alert">
                      <ErrorState title="Submission Failed" message={feedbackError} />
                    </div>
                  )}
                  {feedbackSuccess && (
                    <p className="feedback-success-msg">{feedbackSuccess}</p>
                  )}

                  <div className="form-field">
                    <label className="form-field__label" htmlFor="feedback-rating-select">
                      Service Satisfaction Rating (1-5 Stars)
                    </label>
                    <Select
                      id="feedback-rating-select"
                      name="rating"
                      value={feedbackRating}
                      onChange={(e) => setFeedbackRating(Number(e.target.value))}
                      options={[
                        { value: 5, label: '★★★★★ (5 - Excellent)' },
                        { value: 4, label: '★★★★☆ (4 - Good)' },
                        { value: 3, label: '★★★☆☆ (3 - Satisfactory)' },
                        { value: 2, label: '★★☆☆☆ (2 - Needs Improvement)' },
                        { value: 1, label: '★☆☆☆☆ (1 - Unsatisfactory)' },
                      ]}
                      required
                    />
                  </div>

                  <Textarea
                    id="feedback-comments"
                    name="comments"
                    label="Comments / Repair Quality Review (Optional)"
                    placeholder="Describe how well the repair was resolved or if anything needs further attention..."
                    value={feedbackComments}
                    onChange={(e) => setFeedbackComments(e.target.value)}
                    rows={3}
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={submittingFeedback}
                    loadingText="Submitting..."
                  >
                    ★ Submit Feedback & Rating
                  </Button>
                </form>
              ) : (
                <p className="awaiting-feedback-note">
                  Awaiting service satisfaction rating from the ticket creator.
                </p>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Status Transition Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Update Status: ${targetStatus.replace('_', ' ').toUpperCase()}`}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={submittingStatus}
              loadingText="Updating..."
              onClick={handleStatusSubmit}
            >
              Confirm Transition
            </Button>
          </>
        }
      >
        <form onSubmit={handleStatusSubmit}>
          {statusError && (
            <div className="status-modal-alert">
              <ErrorState title="Validation Error" message={statusError} />
            </div>
          )}

          <p className="modal-prompt-text">
            Transitioning complaint <strong>{complaint.complaintNumber}</strong> from{' '}
            <StatusBadge status={complaint.status} /> to <StatusBadge status={targetStatus} />.
          </p>

          <Textarea
            id="status-note"
            name="note"
            label="Audit Log Note / Resolution Details"
            placeholder={
              ['on_hold', 'resolved', 'rejected'].includes(targetStatus)
                ? 'Mandatory: explain why work is placed on hold or what resolution was performed.'
                : 'Optional comment for the audit history log.'
            }
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            required={['on_hold', 'resolved', 'rejected'].includes(targetStatus)}
          />
        </form>
      </Modal>

      {/* Admin Technician Dispatch Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={`Dispatch Technician: ${complaint.complaintNumber}`}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={submittingAssign}
              loadingText="Assigning..."
              onClick={handleAssignSubmit}
            >
              Confirm Dispatch
            </Button>
          </>
        }
      >
        <form onSubmit={handleAssignSubmit}>
          {assignError && (
            <div className="status-modal-alert">
              <ErrorState title="Dispatch Failed" message={assignError} />
            </div>
          )}

          {technicians.length > 0 ? (
            <Select
              id="detail-assign-tech-select"
              name="technicianId"
              label="Select Active Technician"
              value={selectedTechId}
              onChange={(e) => setSelectedTechId(e.target.value)}
              options={technicians.map((t) => ({
                value: t._id,
                label: `${t.name} (${t.email})`,
              }))}
              required
            />
          ) : (
            <div className="no-tech-notice">
              No active technicians found. Please ensure a technician account exists before dispatching.
            </div>
          )}

          <Textarea
            id="detail-assign-note"
            name="assignNote"
            label="Dispatch Instructions / Work Note"
            placeholder="Optional instructions for technician site access..."
            value={assignNote}
            onChange={(e) => setAssignNote(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
}
