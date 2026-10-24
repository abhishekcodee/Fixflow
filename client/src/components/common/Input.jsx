import { useState } from 'react';
import './Input.css';

export function Input({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  autoComplete,
  showPasswordToggle = false,
  prefix,
  suffix,
  ...rest
}) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || name;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText ? `${inputId}-helper` : undefined;

  const isPasswordField = type === 'password';
  const effectiveType = isPasswordField && showPassword ? 'text' : type;

  return (
    <div className={`form-field ${error ? 'form-field--error' : ''} ${className}`.trim()}>
      {label && (
        <label htmlFor={inputId} className="form-field__label">
          {label}
          {required && <span className="form-field__required" aria-hidden="true"> *</span>}
        </label>
      )}

      <div className={`form-field__control-wrapper ${prefix ? 'has-prefix' : ''} ${isPasswordField && showPasswordToggle ? 'has-suffix' : ''}`}>
        {prefix && <span className="form-field__prefix" aria-hidden="true">{prefix}</span>}

        <input
          id={inputId}
          name={name}
          type={effectiveType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
          autoComplete={autoComplete}
          className="form-field__input"
          {...rest}
        />

        {isPasswordField && showPasswordToggle && (
          <button
            type="button"
            className="form-field__password-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide plain text' : 'Reveal plain text'}
            title={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={0}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}

        {!isPasswordField && suffix && (
          <span className="form-field__suffix">{suffix}</span>
        )}
      </div>

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
