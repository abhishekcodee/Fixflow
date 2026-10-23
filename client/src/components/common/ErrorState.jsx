import { Button } from './Button';
import './ErrorState.css';

export function ErrorState({
  title = 'An error occurred',
  message = 'We encountered an issue loading this information. Please check your network and try again.',
  details,
  onRetry,
  retryText = 'Try Again',
  className = '',
}) {
  return (
    <div className={`error-state ${className}`.trim()} role="alert">
      <div className="error-state__header">
        <span className="error-state__icon" aria-hidden="true">⚠️</span>
        <div className="error-state__text">
          <h3 className="error-state__title">{title}</h3>
          <p className="error-state__message">{message}</p>
          {details && (
            <pre className="error-state__details">
              <code>{typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)}</code>
            </pre>
          )}
        </div>
      </div>

      {onRetry && (
        <div className="error-state__actions">
          <Button variant="danger" size="sm" onClick={onRetry}>
            {retryText}
          </Button>
        </div>
      )}
    </div>
  );
}
