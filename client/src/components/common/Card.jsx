import './Card.css';

export function Card({
  title,
  subtitle,
  action,
  children,
  footer,
  className = '',
  as: Component = 'div',
  ...rest
}) {
  const hasHeader = title || subtitle || action;

  return (
    <Component className={`card ${className}`.trim()} {...rest}>
      {hasHeader && (
        <header className="card__header">
          <div className="card__title-group">
            {title && <h3 className="card__title">{title}</h3>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
          {action && <div className="card__action">{action}</div>}
        </header>
      )}

      <div className="card__body">{children}</div>

      {footer && <footer className="card__footer">{footer}</footer>}
    </Component>
  );
}
