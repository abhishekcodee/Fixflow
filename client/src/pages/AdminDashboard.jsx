import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { complaintsApi, authApi, adminApi } from '../services/api';
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
import { RefreshIcon, ZapIcon } from '../components/common/Icons';
import { ComplaintsMap } from '../components/common/ComplaintsMap';
import './AdminDashboard.css';

export function AdminDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeSection, setActiveSection] = useState('dispatch'); // 'dispatch' | 'technicians' | 'categories' | 'identity'

  const [unassignedComplaints, setUnassignedComplaints] = useState([]);
  const [allComplaints, setAllComplaints] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [adminTechs, setAdminTechs] = useState([]);
  const [categoryMappings, setCategoryMappings] = useState([]);
  const [identityVerifications, setIdentityVerifications] = useState([]);
  const [identityFilter, setIdentityFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Assign modal state
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [matchedTechs, setMatchedTechs] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [requiredSpec, setRequiredSpec] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [useManualId, setUseManualId] = useState(false);

  // Tech Approval action state
  const [processingTechId, setProcessingTechId] = useState(null);

  // Identity review modal state
  const [reviewingVerification, setReviewingVerification] = useState(null);
  const [frontDocUrl, setFrontDocUrl] = useState(null);
  const [backDocUrl, setBackDocUrl] = useState(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [reviewReason, setReviewReason] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  async function loadTriageData(isBackground = false) {
    if (!isBackground) {
      setLoading(true);
      setError(null);
    }
    try {
      const [complaintsRes, allRes, techRes, adminTechRes, catRes, identityRes] = await Promise.all([
        complaintsApi.list({ status: 'submitted', limit: 50 }),
        complaintsApi.list({ limit: 100 }).catch(() => null),
        authApi.getTechnicians().catch(() => ({ technicians: [] })),
        adminApi.getTechnicians().catch(() => ({ technicians: [] })),
        adminApi.getCategoryMappings().catch(() => ({ mappings: [] })),
        adminApi.getIdentityVerifications({ limit: 50 }).catch(() => ({ data: { verifications: [] } })),
      ]);

      setUnassignedComplaints(complaintsRes?.complaints || []);
      setAllComplaints(allRes?.complaints || complaintsRes?.complaints || []);
      setTechnicians(techRes?.technicians || []);
      setAdminTechs(adminTechRes?.technicians || []);
      setCategoryMappings(catRes?.mappings || []);
      setIdentityVerifications(identityRes?.data?.verifications || []);
    } catch (err) {
      if (!isBackground) {
        setError(err.message || 'Unable to retrieve administrative triage data.');
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadTriageData();

      const intervalId = setInterval(() => {
        loadTriageData(true);
      }, 8000);

      const handleFocus = () => loadTriageData(true);
      window.addEventListener('focus', handleFocus);

      return () => {
        clearInterval(intervalId);
        window.removeEventListener('focus', handleFocus);
      };
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  async function openAssignModal(complaint) {
    setSelectedTicket(complaint);
    const defaultId = technicians.length > 0 ? (technicians[0]._id || technicians[0].id) : '';
    setTechnicianId(defaultId);
    setAssignNote('');
    setAssignError('');
    setUseManualId(technicians.length === 0);
    setMatchedTechs([]);
    setLoadingMatches(true);

    try {
      const matchRes = await complaintsApi.getMatchingTechnicians(complaint._id);
      setMatchedTechs(matchRes?.technicians || []);
      setRequiredSpec(matchRes?.requiredSpecialization || '');
      if (matchRes?.technicians?.length > 0) {
        setTechnicianId(matchRes.technicians[0].id);
      }
    } catch {
      // Keep defaultId
    } finally {
      setLoadingMatches(false);
    }
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

  async function handleApprovalStatusChange(techId, newStatus) {
    setProcessingTechId(techId);
    try {
      let reason = undefined;
      if (newStatus === 'rejected') {
        const inputReason = window.prompt('Enter rejection reason:');
        if (!inputReason) {
          setProcessingTechId(null);
          return;
        }
        reason = inputReason;
      }
      await adminApi.updateTechnicianApproval(techId, {
        approvalStatus: newStatus,
        rejectionReason: reason,
      });
      await loadTriageData(true);
    } catch (err) {
      alert(err.message || 'Failed to update technician status');
    } finally {
      setProcessingTechId(null);
    }
  }

  // Open Document Review Modal
  async function openReviewModal(item) {
    setReviewingVerification(item);
    setFrontDocUrl(null);
    setBackDocUrl(null);
    setReviewReason('');
    setReviewError('');
    setLoadingDocs(true);

    try {
      if (item.frontDocumentKey) {
        const frontBlob = await adminApi.getAdminDocumentBlob(item.id, 'front');
        setFrontDocUrl(URL.createObjectURL(frontBlob));
      }
      if (item.backDocumentKey) {
        const backBlob = await adminApi.getAdminDocumentBlob(item.id, 'back');
        setBackDocUrl(URL.createObjectURL(backBlob));
      }
    } catch (err) {
      setReviewError('Failed to load decrypted document images from storage vault.');
    } finally {
      setLoadingDocs(false);
    }
  }

  async function handleReviewDecision(decision) {
    if (!reviewingVerification) return;
    setReviewError('');

    if (decision === 'reject' && !reviewReason.trim()) {
      setReviewError('Please specify a rejection reason before rejecting documents.');
      return;
    }

    setSubmittingReview(true);
    try {
      await adminApi.reviewIdentityVerification(reviewingVerification.id, {
        decision,
        rejectionReason: decision === 'reject' ? reviewReason.trim() : undefined
      });
      setReviewingVerification(null);
      await loadTriageData(true);
    } catch (err) {
      setReviewError(err.message || 'Failed to update verification status.');
    } finally {
      setSubmittingReview(false);
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

  const filteredVerifications = identityVerifications.filter((v) => {
    if (identityFilter === 'ALL') return true;
    return v.verificationStatus === identityFilter;
  });

  return (
    <div className="admin-page">
      <PageHeader
        title="Facilities Administration & Dispatch Console"
        description="Review incident submissions, smart dispatch certified technicians, and govern staff specializations."
        actions={
          <Button variant="secondary" size="sm" onClick={() => loadTriageData(false)} className="btn-with-icon">
            <RefreshIcon size={14} />
            <span>Refresh Console</span>
          </Button>
        }
      />

      {/* Navigation Tabs */}
      <div className="admin-section-tabs">
        <button
          type="button"
          className={`admin-nav-tab ${activeSection === 'dispatch' ? 'active' : ''}`}
          onClick={() => setActiveSection('dispatch')}
        >
          ⚡ Triage Queue ({unassignedComplaints.length})
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${activeSection === 'technicians' ? 'active' : ''}`}
          onClick={() => setActiveSection('technicians')}
        >
          👷 Technicians Directory ({adminTechs.length})
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${activeSection === 'identity' ? 'active' : ''}`}
          onClick={() => setActiveSection('identity')}
        >
          🛡️ Identity Verifications ({identityVerifications.length})
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${activeSection === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveSection('categories')}
        >
          📐 Category Mappings ({categoryMappings.length})
        </button>
      </div>

      {activeSection === 'dispatch' && (
        <>
          {/* Real-time Admin Dispatch & Incident Map */}
          <ComplaintsMap
            complaints={allComplaints}
            title="Admin Facility Dispatch & Incident Map"
            subtitle="Geospatial overview of active incidents across campus — dispatch technicians and monitor SLA responses"
            onRefresh={() => loadTriageData(false)}
            userRole="admin"
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
                            className="btn-with-icon"
                          >
                            <ZapIcon size={14} />
                            <span>Dispatch</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {activeSection === 'technicians' && (
        <Card
          title="Technician Directory & Approval Governance"
          subtitle="Review registered maintenance personnel, verified credentials, and manage approval status"
          className="admin-triage-card"
        >
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Technician</th>
                  <th>Primary Specialization</th>
                  <th>Experience</th>
                  <th>Service Area</th>
                  <th>Identity Status</th>
                  <th>Approval Status</th>
                  <th>Availability</th>
                  <th>Governance Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminTechs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-6">
                      No technicians currently registered.
                    </td>
                  </tr>
                ) : (
                  adminTechs.map((tech) => {
                    const prof = tech.technicianProfile || {};
                    const isProcessing = processingTechId === tech.id;
                    return (
                      <tr key={tech.id}>
                        <td>
                          <div className="font-medium">{tech.name}</div>
                          <div className="text-xs text-muted font-mono">{tech.email}</div>
                          {tech.phone && <div className="text-xs text-muted">{tech.phone}</div>}
                        </td>
                        <td>
                          <span className="font-semibold text-primary capitalize">
                            {prof.primarySpecialization || 'general'}
                          </span>
                          {prof.customSpecialization && (
                            <div className="text-xs text-muted">({prof.customSpecialization})</div>
                          )}
                        </td>
                        <td className="text-xs">
                          {prof.experienceYears !== null && prof.experienceYears !== undefined
                            ? `${prof.experienceYears} Years`
                            : '—'}
                        </td>
                        <td className="text-xs text-muted">
                          {prof.serviceArea || 'Campus-wide'}
                        </td>
                        <td>
                          <StatusBadge status={tech.identityStatus || 'pending'} size="sm" />
                          {tech.identityNumberMasked && (
                            <div className="text-xs text-muted font-mono">{tech.identityNumberMasked}</div>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={prof.approvalStatus || 'pending_approval'} size="sm" />
                        </td>
                        <td>
                          <StatusBadge status={prof.isAvailable ? 'available' : 'unavailable'} size="sm" />
                        </td>
                        <td>
                          <div className="admin-actions-cell">
                            {prof.approvalStatus !== 'approved' && (
                              <Button
                                variant="success"
                                size="sm"
                                isLoading={isProcessing}
                                onClick={() => handleApprovalStatusChange(tech.id, 'approved')}
                              >
                                Approve
                              </Button>
                            )}
                            {prof.approvalStatus !== 'rejected' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                isLoading={isProcessing}
                                onClick={() => handleApprovalStatusChange(tech.id, 'rejected')}
                              >
                                Reject
                              </Button>
                            )}
                            {prof.approvalStatus === 'approved' && (
                              <Button
                                variant="danger"
                                size="sm"
                                isLoading={isProcessing}
                                onClick={() => handleApprovalStatusChange(tech.id, 'suspended')}
                              >
                                Suspend
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Identity Verifications Tab (Module 5) */}
      {activeSection === 'identity' && (
        <Card
          title="Aadhaar Identity Verifications & Document Review"
          subtitle="Audit submitted government identities, review encrypted card documents, and govern credential approvals"
          className="admin-triage-card"
        >
          <div className="identity-filters-bar">
            <span>Filter Status:</span>
            {['ALL', 'PENDING_REVIEW', 'OTP_VERIFIED', 'DOCUMENTS_UPLOADED', 'VERIFIED', 'REJECTED'].map((st) => (
              <button
                key={st}
                type="button"
                className={`identity-filter-btn ${identityFilter === st ? 'active' : ''}`}
                onClick={() => setIdentityFilter(st)}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User / Technician</th>
                  <th>Role</th>
                  <th>Masked Aadhaar</th>
                  <th>Verification Status</th>
                  <th>Documents</th>
                  <th>Submitted At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVerifications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-6">
                      No verification requests matching "{identityFilter}".
                    </td>
                  </tr>
                ) : (
                  filteredVerifications.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="font-medium">{item.user?.name || 'Unknown'}</div>
                        <div className="text-xs text-muted font-mono">{item.user?.email}</div>
                      </td>
                      <td>
                        <StatusBadge status={item.user?.role || 'user'} size="sm" />
                      </td>
                      <td>
                        <span className="font-mono font-semibold text-primary">{item.aadhaarNumberMasked}</span>
                      </td>
                      <td>
                        <StatusBadge status={item.verificationStatus.toLowerCase()} size="sm" />
                      </td>
                      <td>
                        {item.frontDocumentKey && item.backDocumentKey ? (
                          <span className="text-xs text-success font-medium">📷 Both Uploaded</span>
                        ) : item.frontDocumentKey ? (
                          <span className="text-xs text-warning">Front Only</span>
                        ) : (
                          <span className="text-xs text-muted">No Images</span>
                        )}
                      </td>
                      <td className="text-xs text-muted">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openReviewModal(item)}
                        >
                          Review Documents
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeSection === 'categories' && (
        <Card
          title="Intelligent Category-to-Specialization Rules"
          subtitle="Automatic mapping used by the dispatch engine to pair maintenance complaints with qualified technicians"
          className="admin-triage-card"
        >
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category Key</th>
                  <th>Display Label</th>
                  <th>Primary Specialization</th>
                  <th>Secondary Specializations</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {categoryMappings.map((cat) => (
                  <tr key={cat.category}>
                    <td className="font-mono font-bold text-xs">{cat.category}</td>
                    <td className="font-medium">{cat.label}</td>
                    <td>
                      <span className="font-semibold text-primary capitalize">
                        {cat.primarySpecialization}
                      </span>
                    </td>
                    <td className="text-xs text-muted">
                      {Array.isArray(cat.secondarySpecializations) && cat.secondarySpecializations.length > 0
                        ? cat.secondarySpecializations.join(', ')
                        : '—'}
                    </td>
                    <td className="text-xs text-muted">{cat.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Identity Document Review Modal (Module 5) */}
      {reviewingVerification && (
        <div className="doc-modal-overlay" onClick={() => setReviewingVerification(null)}>
          <div className="admin-review-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="doc-modal-header">
              <div>
                <h4 style={{ margin: 0 }}>Review Aadhaar Documents: {reviewingVerification.user?.name}</h4>
                <span className="text-xs text-muted">
                  ID: {reviewingVerification.aadhaarNumberMasked} | Role: {reviewingVerification.user?.role}
                </span>
              </div>
              <button type="button" className="doc-modal-close" onClick={() => setReviewingVerification(null)}>✕</button>
            </div>

            <div className="admin-review-modal-body">
              {reviewError && (
                <div style={{ marginBottom: '12px' }}>
                  <ErrorState title="Review Notice" message={reviewError} />
                </div>
              )}

              {loadingDocs ? (
                <p className="text-center py-6 text-muted">Decrypting uploaded document images from vault...</p>
              ) : (
                <div className="admin-docs-side-by-side">
                  <div className="admin-doc-frame">
                    <span className="font-semibold text-xs text-muted mb-1 block">Front Side:</span>
                    {frontDocUrl ? (
                      <img src={frontDocUrl} alt="Aadhaar Front" className="admin-doc-preview-img" />
                    ) : (
                      <div className="no-doc-placeholder">Front image not uploaded</div>
                    )}
                  </div>
                  <div className="admin-doc-frame">
                    <span className="font-semibold text-xs text-muted mb-1 block">Back Side:</span>
                    {backDocUrl ? (
                      <img src={backDocUrl} alt="Aadhaar Back" className="admin-doc-preview-img" />
                    ) : (
                      <div className="no-doc-placeholder">Back image not uploaded</div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '16px' }}>
                <Textarea
                  id="admin-review-reason"
                  label="Rejection Reason (Required only if rejecting):"
                  placeholder="e.g. Back image is blurry, name on card does not match account, etc."
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="admin-review-actions-bar">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setReviewingVerification(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  isLoading={submittingReview}
                  onClick={() => handleReviewDecision('reject')}
                >
                  Reject Verification
                </Button>
                <Button
                  variant="success"
                  size="md"
                  isLoading={submittingReview}
                  onClick={() => handleReviewDecision('approve')}
                >
                  Approve Verification
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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

          <div className="assign-ticket-meta">
            <div>
              Title: <strong>{selectedTicket?.title}</strong>
            </div>
            <div className="text-xs text-muted mt-1">
              Category: <span className="capitalize font-semibold">{selectedTicket?.category}</span> | Required Specialty:{' '}
              <strong className="text-primary">{requiredSpec?.toUpperCase() || 'GENERAL'}</strong>
            </div>
          </div>

          {/* Smart Recommended Matches */}
          <div className="modal-smart-matches-box">
            <label className="input-label">⚡ AI Recommended Specialists:</label>
            {loadingMatches ? (
              <div className="text-xs text-muted py-2">Searching available qualified technicians...</div>
            ) : matchedTechs.length > 0 ? (
              <div className="matched-techs-grid">
                {matchedTechs.map((tech) => {
                  const isSelected = technicianId === tech.id;
                  return (
                    <div
                      key={tech.id}
                      className={`matched-tech-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setTechnicianId(tech.id)}
                    >
                      <div className="matched-tech-row">
                        <strong>{tech.name}</strong>
                        <StatusBadge status={tech.isAvailable ? 'available' : 'unavailable'} size="sm" />
                      </div>
                      <div className="matched-tech-specs">
                        <span>🔧 {tech.primarySpecialization}</span>
                        <span>⭐ {tech.experienceYears || 0}y exp</span>
                        <span>📋 {tech.activeWorkload} active jobs</span>
                      </div>
                      {tech.distanceKm !== undefined && (
                        <div className="text-xs text-muted mt-1">📍 {tech.distanceKm} km from incident</div>
                      )}
                      {isSelected && <div className="selected-badge">✓ Selected</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-tech-notice">
                ⚠️ No approved technicians with specialization matching <strong>{requiredSpec}</strong> are currently online.
              </div>
            )}
          </div>

          {!useManualId && (
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
                Or enter technician ID manually
              </button>
            </div>
          )}

          {useManualId && (
            <div className="technician-picker-group">
              <Input
                id="assign-tech-id"
                name="technicianId"
                label="Technician User ID"
                placeholder="e.g. user ID"
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn-link-subtle"
                onClick={() => setUseManualId(false)}
              >
                ← Back to technician selection list
              </button>
            </div>
          )}

          <Textarea
            id="assign-note"
            name="note"
            label="Dispatch Instructions / Access Notes"
            placeholder="Special tools required, access door instructions, or high-priority notes..."
            value={assignNote}
            onChange={(e) => setAssignNote(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
}
