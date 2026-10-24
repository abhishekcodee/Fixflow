import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { ErrorState } from '../components/common/ErrorState';
import { GitHubIcon } from '../components/common/Icons';
import { authApi } from '../services/api';
import './Auth.css';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  async function handleGitHubLogin() {
    setFormError('');
    setGithubLoading(true);
    try {
      let clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
      if (!clientId) {
        const config = await authApi.getGithubConfig();
        clientId = config?.clientId;
      }

      if (!clientId) {
        throw new Error(
          'GitHub Login is not configured on the server yet. Please add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the server environment.'
        );
      }

      const redirectUri = `${window.location.origin}/auth/github/callback`;
      const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&scope=user:email`;

      window.location.href = githubUrl;
    } catch (err) {
      setFormError(err.message || 'Unable to initiate GitHub sign in.');
      setGithubLoading(false);
    }
  }

  function validate() {
    const errors = {};
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(err.message || 'Login failed. Please check your credentials and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card-wrapper">
        <div className="auth-brand">
          <div className="auth-brand__logo" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <h1 className="auth-brand__title">FixFlow</h1>
          <p className="auth-brand__tagline">Enterprise Facilities Care & Incident Management</p>
        </div>

        <Card className="auth-card">
          <div className="auth-card__header">
            <h2 className="auth-card__heading">Sign In</h2>
            <p className="auth-card__subheading">Access your facilities dashboard and work orders.</p>
          </div>

          {formError && (
            <div className="auth-card__alert">
              <ErrorState title="Authentication Failed" message={formError} />
            </div>
          )}

          <button
            type="button"
            className="auth-github-btn"
            onClick={handleGitHubLogin}
            disabled={githubLoading}
          >
            <GitHubIcon size={20} />
            <span>{githubLoading ? 'Connecting to GitHub...' : 'Continue with GitHub'}</span>
          </button>

          <div className="auth-oauth-divider">
            <span>or sign in with email</span>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <Input
              id="login-email"
              name="email"
              type="email"
              label="Email Address"
              placeholder="name@organization.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              autoComplete="email"
              required
            />

            <Input
              id="login-password"
              name="password"
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              autoComplete="current-password"
              showPasswordToggle={true}
              required
            />

            <div className="auth-card__forgot-row">
              <Link to="/forgot-password" className="auth-card__forgot-link">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              loadingText="Signing In..."
              className="auth-card__submit-btn"
            >
              Sign In to Account
            </Button>
          </form>

          <div className="auth-card__footer">
            <p className="auth-card__switch-text">
              Don't have an account?{' '}
              <Link to="/register" className="auth-card__link">
                Register here
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
