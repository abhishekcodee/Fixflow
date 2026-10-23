import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

export function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const role = user?.role || 'user';

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['user', 'admin', 'technician'] },
    { to: '/complaints', label: 'Complaints', icon: '📋', roles: ['user', 'admin', 'technician'] },
    { to: '/complaints/new', label: 'Report Issue', icon: '➕', roles: ['user', 'admin'] },
    { to: '/technician', label: 'Work Orders', icon: '🛠️', roles: ['technician', 'admin'] },
    { to: '/admin', label: 'Admin Dispatch', icon: '⚡', roles: ['admin'] },
  ];

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <>
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <div className="sidebar__logo-mark" aria-hidden="true">FF</div>
          <div className="sidebar__brand-text">
            <span className="sidebar__brand-name">FixFlow</span>
            <span className="sidebar__brand-desc">Facilities Care</span>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Main Navigation">
          <div className="sidebar__nav-section">
            <span className="sidebar__nav-heading">Menu</span>
            <ul className="sidebar__nav-list">
              {visibleItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/dashboard'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `sidebar__nav-link ${isActive ? 'sidebar__nav-link--active' : ''}`
                    }
                  >
                    <span className="sidebar__nav-icon" aria-hidden="true">{item.icon}</span>
                    <span className="sidebar__nav-text">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user-profile">
            <div className="sidebar__avatar" aria-hidden="true">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="sidebar__user-details">
              <span className="sidebar__user-name">{user?.name || 'Guest User'}</span>
              <span className="sidebar__user-role">{role.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
