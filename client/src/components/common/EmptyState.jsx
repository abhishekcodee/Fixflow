import { ComplaintsIcon } from './Icons';
import './EmptyState.css';

export function EmptyState({
  title = 'No items found',
  description,
  icon,
  action,
  className = '',
}) {
  const IconElement = icon || <ComplaintsIcon size={36} />;

  return (
    <div className={`empty-state ${className}`.trim()}>
      <div className="empty-state__icon-box" aria-hidden="true">
        {IconElement}
      </div>
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__description">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
