import './LoadingState.css';

export function LoadingState({
  message = 'Loading FixFlow data...',
  description,
  minHeight = '200px',
  className = '',
}) {
  return (
    <div
      className={`loading-state ${className}`.trim()}
      style={{ minHeight }}
      role="status"
      aria-live="polite"
    >
      <div className="loading-state__spinner" aria-hidden="true" />
      <p className="loading-state__message">{message}</p>
      {description && <p className="loading-state__description">{description}</p>}
    </div>
  );
}
