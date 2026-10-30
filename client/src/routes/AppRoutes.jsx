import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { LoadingState } from '../components/common/LoadingState';

// Pages
import { Login } from '../pages/Login';
import { Register } from '../pages/Register';
import { ForgotPassword } from '../pages/ForgotPassword';
import { UserDashboard } from '../pages/UserDashboard';
import { ComplaintList } from '../pages/ComplaintList';
import { ComplaintDetail } from '../pages/ComplaintDetail';
import { CreateComplaint } from '../pages/CreateComplaint';
import { AdminDashboard } from '../pages/AdminDashboard';
import { TechnicianDashboard } from '../pages/TechnicianDashboard';
import { Settings } from '../pages/Settings';
import { GitHubCallback } from '../pages/GitHubCallback';
import { NotFound } from '../pages/NotFound';

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState message="Verifying session authorization..." minHeight="100vh" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingState message="Loading FixFlow..." minHeight="100vh" />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Authentication routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route
        path="/auth/github/callback"
        element={
          <PublicRoute>
            <GitHubCallback />
          </PublicRoute>
        }
      />

      {/* Protected Application Shell routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/complaints" element={<ComplaintList />} />
        <Route path="/complaints/new" element={<CreateComplaint />} />
        <Route path="/complaints/:id" element={<ComplaintDetail />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/technician" element={<TechnicianDashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
