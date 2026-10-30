import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  DashboardIcon,
  ComplaintsIcon,
  PlusCircleIcon,
  WrenchIcon,
  ZapIcon,
  SettingsIcon,
} from '../common/Icons';
import './Sidebar.css';

export function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const role = user?.role || 'user';

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon, roles: ['user', 'admin', 'technician'] },
    { to: '/complaints', label: 'Complaints', icon: ComplaintsIcon, roles: ['user', 'admin', 'technician'] },
    { to: '/complaints/new', label: 'Report Issue', icon: PlusCircleIcon, roles: ['user', 'admin'] },
    { to: '/technician', label: 'Work Orders', icon: WrenchIcon, roles: ['technician', 'admin'] },
    { to: '/admin', label: 'Admin Dispatch', icon: ZapIcon, roles: ['admin'] },
    { to: '/settings', label: 'Account Settings', icon: SettingsIcon, roles: ['user', 'admin', 'technician'] },
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
          <button
            type="button"
            className="sidebar__close-btn"
            onClick={onClose}
            aria-label="Close navigation drawer"
          >
            ✕
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Main Navigation">
          <div className="sidebar__nav-section">
            <span className="sidebar__nav-heading">Menu</span>
            <ul className="sidebar__nav-list">
              {visibleItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/dashboard'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `sidebar__nav-link ${isActive ? 'sidebar__nav-link--active' : ''}`
                      }
                    >
                      <span className="sidebar__nav-icon-wrapper" aria-hidden="true">
                        <IconComponent size={18} className="sidebar__nav-icon" />
                      </span>
                      <span className="sidebar__nav-text">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
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
