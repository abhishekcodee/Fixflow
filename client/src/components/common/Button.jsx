import './Button.css';

export function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  disabled = false,
  className = '',
  onClick,
  ...rest
}) {
  const isButtonDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isButtonDisabled}
      aria-busy={isLoading}
      onClick={onClick}
      className={`btn btn--${variant} btn--${size} ${isLoading ? 'btn--loading' : ''} ${className}`.trim()}
      {...rest}
    >
      {isLoading && (
        <span className="btn__spinner" aria-hidden="true" />
      )}
      <span className="btn__content">
        {isLoading && loadingText ? loadingText : children}
      </span>
    </button>
  );
}
