import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboard } from '../AdminDashboard';
import { complaintsApi, authApi } from '../../services/api';
import * as authContext from '../../context/AuthContext';

describe('AdminDashboard Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders unauthorized view when caller is a standard user', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'u1', role: 'user' },
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('Administrator Access Required')).toBeInTheDocument();
  });

  it('loads unassigned complaints and active technicians for administrator', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'a1', role: 'admin' },
    });

    const mockUnassigned = [
      {
        _id: 'c_sub_1',
        complaintNumber: 'FIX-202610-0010',
        title: 'Roof leak on top floor',
        category: 'carpentry',
        priority: 'urgent',
        status: 'submitted',
        location: { building: 'East Tower', floor: '12' },
        createdBy: { name: 'Tenant Tim' },
      },
    ];

    const mockTechs = [
      { _id: 'tech_99', name: 'Sam Sparks', email: 'sam@fixflow.com', role: 'technician' },
    ];

    vi.spyOn(complaintsApi, 'list').mockResolvedValue({ complaints: mockUnassigned });
    vi.spyOn(authApi, 'getTechnicians').mockResolvedValue({ technicians: mockTechs });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    expect(await screen.findByText('FIX-202610-0010')).toBeInTheDocument();
    expect(screen.getByText('Roof leak on top floor')).toBeInTheDocument();
    expect(screen.getByText('Tenant Tim')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dispatch/i })).toBeInTheDocument();
  });

  it('opens dispatch modal and assigns selected technician', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'a1', role: 'admin' },
    });

    const mockUnassigned = [
      {
        _id: 'c_sub_1',
        complaintNumber: 'FIX-202610-0010',
        title: 'Roof leak on top floor',
        category: 'carpentry',
        priority: 'urgent',
        status: 'submitted',
        location: { building: 'East Tower', floor: '12' },
        createdBy: { name: 'Tenant Tim' },
      },
    ];

    const mockTechs = [
      { _id: 'tech_99', name: 'Sam Sparks', email: 'sam@fixflow.com', role: 'technician' },
    ];

    vi.spyOn(complaintsApi, 'list').mockResolvedValue({ complaints: mockUnassigned });
    vi.spyOn(authApi, 'getTechnicians').mockResolvedValue({ technicians: mockTechs });
    const assignSpy = vi.spyOn(complaintsApi, 'assign').mockResolvedValue({ success: true });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    const dispatchBtn = await screen.findByRole('button', { name: /dispatch/i });
    fireEvent.click(dispatchBtn);

    // Modal opens
    expect(screen.getByText('Dispatch Ticket: FIX-202610-0010')).toBeInTheDocument();
    expect(screen.getByLabelText(/assign to active technician/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /confirm assignment/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith('c_sub_1', {
        technicianId: 'tech_99',
        note: undefined,
      });
    });
  });
});
