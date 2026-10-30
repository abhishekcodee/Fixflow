import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('fixflow_token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Re-verify session on mount if token exists
  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      if (!token) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const response = await authApi.getProfile();
        const profileUser = response?.user || response?.data?.user;
        if (mounted && profileUser) {
          setUser(profileUser);
        }
      } catch {
        // Token invalid or expired: clear stale credentials
        if (mounted) {
          localStorage.removeItem('fixflow_token');
          setToken(null);
          setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [token]);

  const login = useCallback(async (email, password) => {
    setError(null);
    const res = await authApi.login({ email, password });
    const payload = res?.data || res;
    const authToken = payload?.token || res?.token;
    const authUser = payload?.user || res?.user;

    if (authToken && authUser) {
      localStorage.setItem('fixflow_token', authToken);
      setToken(authToken);
      setUser(authUser);
      return authUser;
    }
    throw new Error('Authentication response was missing token or user data.');
  }, []);

  const setSession = useCallback((newToken, newUser) => {
    if (newToken && newUser) {
      localStorage.setItem('fixflow_token', newToken);
      setToken(newToken);
      setUser(newUser);
      setError(null);
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    setError(null);
    const res = await authApi.register({ name, email, password });
    const payload = res?.data || res;
    const authToken = payload?.token || res?.token;
    const authUser = payload?.user || res?.user;

    if (authToken && authUser) {
      localStorage.setItem('fixflow_token', authToken);
      setToken(authToken);
      setUser(authUser);
      return authUser;
    }
    throw new Error('Registration response was missing token or user data.');
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await authApi.logout();
      }
    } catch {
      // Ignore network errors on logout since local state is purged anyway
    } finally {
      localStorage.removeItem('fixflow_token');
      setToken(null);
      setUser(null);
      setError(null);
    }
  }, [token]);

  const loginWithGithub = useCallback(async (code) => {
    setError(null);
    const res = await authApi.githubLogin(code);
    const payload = res?.data || res;
    const authToken = payload?.token || res?.token;
    const authUser = payload?.user || res?.user;

    if (authToken && authUser) {
      localStorage.setItem('fixflow_token', authToken);
      setToken(authToken);
      setUser(authUser);
      return authUser;
    }
    throw new Error('GitHub authentication response was missing token or user data.');
  }, []);

  const updateUser = useCallback((updatedUserData) => {
    setUser((prev) => (prev ? { ...prev, ...updatedUserData } : updatedUserData));
  }, []);

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user && !!token,
    role: user?.role || null,
    login,
    register,
    loginWithGithub,
    logout,
    setSession,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
