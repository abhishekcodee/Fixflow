import './PageHeader.css';

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className = '',
}) {
  return (
    <div className={`page-header ${className}`.trim()}>
      <div className="page-header__main">
        {breadcrumbs && <nav className="page-header__breadcrumbs" aria-label="Breadcrumb">{breadcrumbs}</nav>}
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>

      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
