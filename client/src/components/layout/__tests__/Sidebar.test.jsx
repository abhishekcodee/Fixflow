import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import * as authContext from '../../../context/AuthContext';

describe('Sidebar Component & Role-Specific Navigation', () => {
  it('renders standard user navigation links', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'u1', name: 'Standard User', role: 'user' },
    });

    render(
      <MemoryRouter>
        <Sidebar isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /complaints/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /report issue/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /admin dispatch/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /work orders/i })).not.toBeInTheDocument();
  });

  it('renders technician-specific navigation links', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 't1', name: 'Technician Tom', role: 'technician' },
    });

    render(
      <MemoryRouter>
        <Sidebar isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /complaints/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /work orders/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /report issue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /admin dispatch/i })).not.toBeInTheDocument();
  });

  it('renders administrator navigation links including dispatch and work orders', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'a1', name: 'Admin Alice', role: 'admin' },
    });

    render(
      <MemoryRouter>
        <Sidebar isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /complaints/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /report issue/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /work orders/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /admin dispatch/i })).toBeInTheDocument();
  });
});
