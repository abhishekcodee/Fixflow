import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { Login } from '../Login';
import { Register } from '../Register';
import { ForgotPassword } from '../ForgotPassword';

describe('Authentication Pages & Form Validation', () => {
  describe('Login Page', () => {
    it('renders login form elements', () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in to account/i })).toBeInTheDocument();
    });

    it('validates mandatory fields on empty submit', () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /sign in to account/i }));

      expect(screen.getByText('Email address is required.')).toBeInTheDocument();
      expect(screen.getByText('Password is required.')).toBeInTheDocument();
    });

    it('rejects malformed email format', () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'not-an-email' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in to account/i }));

      expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    });
  });

  describe('Register Page', () => {
    it('renders registration form elements', () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <Register />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /resident \/ user/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /technician/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('allows toggling between Resident/User and Technician role', () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <Register />
          </AuthProvider>
        </MemoryRouter>
      );

      const userRadio = screen.getByRole('radio', { name: /resident \/ user/i });
      const techRadio = screen.getByRole('radio', { name: /technician/i });

      expect(userRadio).toHaveAttribute('aria-checked', 'true');
      expect(techRadio).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(techRadio);

      expect(userRadio).toHaveAttribute('aria-checked', 'false');
      expect(techRadio).toHaveAttribute('aria-checked', 'true');
    });

    it('enforces password policy and matching confirmation', () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <Register />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Alex Morgan' },
      });
      fireEvent.change(screen.getByLabelText(/^email address/i), {
        target: { value: 'alex@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password/i), {
        target: { value: 'short' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'different' },
      });

      fireEvent.click(
        screen.getByRole('button', { name: /(send verification code|complete registration)/i })
      );

      expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    });
  });

  describe('Forgot Password Page', () => {
    it('renders forgot password elements', () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <ForgotPassword />
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /forgot password/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send recovery code/i })).toBeInTheDocument();
    });
  });
});
