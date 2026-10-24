import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from '../components/common/LoadingState';
import { Button } from '../components/common/Button';
import './Auth.css';

export function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithGithub } = useAuth();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const executedRef = useRef(false);

  useEffect(() => {
    // Prevent double execution in React StrictMode
    if (executedRef.current) return;
    executedRef.current = true;

    const code = searchParams.get('code');
    const oauthError = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (oauthError) {
      setError(errorDescription || 'GitHub authorization was denied or cancelled.');
      setLoading(false);
      return;
    }

    if (!code) {
      setError('No authorization code was returned from GitHub.');
      setLoading(false);
      return;
    }

    async function handleAuth() {
      try {
        const user = await loginWithGithub(code);
        if (user?.role === 'technician') {
          navigate('/technician', { replace: true });
        } else if (user?.role === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } catch (err) {
        setError(err.message || 'Failed to authenticate with GitHub. Please try again.');
        setLoading(false);
      }
    }

    handleAuth();
  }, [searchParams, loginWithGithub, navigate]);

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <LoadingState message="Connecting with GitHub and verifying your account..." />
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '440px', textAlign: 'center' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--color-danger, #ef4444)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            fontSize: '28px',
          }}
        >
          ✕
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>
          GitHub Sign-In Failed
        </h2>

        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
          {error}
        </p>

        <Link to="/login" style={{ textDecoration: 'none' }}>
          <Button variant="primary" style={{ width: '100%' }}>
            Back to Sign In
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default GitHubCallback;
