import './StatusBadge.css';

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', className: 'badge--status-submitted' },
  assigned: { label: 'Assigned', className: 'badge--status-assigned' },
  in_progress: { label: 'In Progress', className: 'badge--status-in-progress' },
  on_hold: { label: 'On Hold', className: 'badge--status-on-hold' },
  resolved: { label: 'Resolved', className: 'badge--status-resolved' },
  closed: { label: 'Closed', className: 'badge--status-closed' },
  rejected: { label: 'Rejected', className: 'badge--status-rejected' },
  // Technician Approval & Verification Statuses
  approved: { label: 'Approved', className: 'badge--status-resolved' },
  pending_approval: { label: 'Pending Approval', className: 'badge--status-on-hold' },
  pending_verification: { label: 'Pending Verification', className: 'badge--status-on-hold' },
  suspended: { label: 'Suspended', className: 'badge--status-rejected' },
  verified: { label: 'Identity Verified', className: 'badge--status-resolved' },
  unverified: { label: 'Unverified', className: 'badge--neutral' },
  pending: { label: 'Verification Pending', className: 'badge--status-on-hold' },
  available: { label: 'Online / Available', className: 'badge--status-resolved' },
  unavailable: { label: 'Offline / Busy', className: 'badge--neutral' },
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', className: 'badge--priority-low' },
  medium: { label: 'Medium', className: 'badge--priority-medium' },
  high: { label: 'High', className: 'badge--priority-high' },
  urgent: { label: 'Urgent', className: 'badge--priority-urgent' },
};

export function StatusBadge({
  status,
  priority,
  variant = 'status',
  label: customLabel,
  className = '',
}) {
  let config = null;
  let text = customLabel;

  if (variant === 'priority' || priority) {
    const key = (priority || status || '').toLowerCase();
    config = PRIORITY_CONFIG[key] || { label: key || 'Unknown', className: 'badge--neutral' };
    text = customLabel || config.label;
  } else {
    const key = (status || '').toLowerCase();
    config = STATUS_CONFIG[key] || { label: key || 'Unknown', className: 'badge--neutral' };
    text = customLabel || config.label;
  }

  return (
    <span className={`badge ${config.className} ${className}`.trim()}>
      <span className="badge__dot" aria-hidden="true" />
      <span className="badge__text">{text}</span>
    </span>
  );
}
