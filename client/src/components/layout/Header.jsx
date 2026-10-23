import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import './Header.css';

export function Header({ onMenuToggle }) {
  const { user, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="app-header__left">
        <button
          type="button"
          className="app-header__menu-btn"
          onClick={onMenuToggle}
          aria-label="Toggle navigation drawer"
        >
          <span className="app-header__menu-icon" aria-hidden="true">☰</span>
        </button>

        <span className="app-header__brand-mobile">FixFlow</span>
      </div>

      <div className="app-header__right">
        <div className="app-header__user-info">
          <span className="app-header__greeting">
            Signed in as <strong>{user?.name || user?.email || 'User'}</strong>
          </span>
          <span className="app-header__role-pill">{user?.role || 'user'}</span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={logout}
          aria-label="Sign out of FixFlow"
        >
          Sign Out
        </Button>
      </div>
    </header>
  );
}
