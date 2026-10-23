import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ComplaintList } from '../ComplaintList';
import { complaintsApi } from '../../services/api';

describe('ComplaintList Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    vi.spyOn(complaintsApi, 'list').mockReturnValue(new Promise(() => {})); // pending

    render(
      <MemoryRouter>
        <ComplaintList />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading complaints...')).toBeInTheDocument();
  });

  it('renders complaints table when API returns items', async () => {
    const mockComplaints = [
      {
        _id: 'c1',
        complaintNumber: 'FIX-202610-0001',
        title: 'Broken elevator button',
        category: 'electrical',
        priority: 'high',
        status: 'in_progress',
        createdAt: '2026-10-23T10:00:00.000Z',
        assignedTo: { name: 'Tech Dave' },
      },
    ];

    vi.spyOn(complaintsApi, 'list').mockResolvedValue({
      complaints: mockComplaints,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <ComplaintList />
      </MemoryRouter>
    );

    expect(await screen.findByText('FIX-202610-0001')).toBeInTheDocument();
    expect(screen.getByText('Broken elevator button')).toBeInTheDocument();
    expect(screen.getByText('Tech Dave')).toBeInTheDocument();
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
  });

  it('renders EmptyState when API returns zero complaints', async () => {
    vi.spyOn(complaintsApi, 'list').mockResolvedValue({
      complaints: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <ComplaintList />
      </MemoryRouter>
    );

    expect(await screen.findByText('No complaints recorded')).toBeInTheDocument();
  });

  it('renders ErrorState and supports retry on network error', async () => {
    const listSpy = vi.spyOn(complaintsApi, 'list')
      .mockRejectedValueOnce(new Error('Network connection dropped'))
      .mockResolvedValueOnce({
        complaints: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
      });

    render(
      <MemoryRouter>
        <ComplaintList />
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Network connection dropped')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('applies filters and queries API with updated parameters', async () => {
    const listSpy = vi.spyOn(complaintsApi, 'list').mockResolvedValue({
      complaints: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <ComplaintList />
      </MemoryRouter>
    );

    await screen.findByText('No complaints recorded');

    fireEvent.change(screen.getByLabelText(/^status/i), {
      target: { value: 'resolved' },
    });

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'resolved' })
      );
    });
  });
});
