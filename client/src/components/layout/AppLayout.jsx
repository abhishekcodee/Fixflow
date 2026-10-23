import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import './AppLayout.css';

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="app-shell">
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

      <div className="app-main-wrapper">
        <Header onMenuToggle={toggleSidebar} />

        <main className="app-content" id="main-content">
          <div className="app-content__container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
