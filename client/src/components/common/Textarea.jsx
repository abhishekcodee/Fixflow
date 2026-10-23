import './Textarea.css';

export function Textarea({
  id,
  name,
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  ...rest
}) {
  const textareaId = id || name;
  const errorId = error ? `${textareaId}-error` : undefined;
  const helperId = helperText ? `${textareaId}-helper` : undefined;

  return (
    <div className={`form-field ${error ? 'form-field--error' : ''} ${className}`.trim()}>
      {label && (
        <label htmlFor={textareaId} className="form-field__label">
          {label}
          {required && <span className="form-field__required" aria-hidden="true"> *</span>}
        </label>
      )}

      <textarea
        id={textareaId}
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
        className="form-field__textarea"
        {...rest}
      />

      {error && (
        <p id={errorId} className="form-field__error" role="alert">
          {error}
        </p>
      )}

      {!error && helperText && (
        <p id={helperId} className="form-field__helper">
          {helperText}
        </p>
      )}
    </div>
  );
}
