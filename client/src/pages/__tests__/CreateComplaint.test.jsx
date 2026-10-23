import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CreateComplaint } from '../CreateComplaint';
import { complaintsApi } from '../../services/api';

describe('CreateComplaint Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates mandatory fields on submit without input', () => {
    render(
      <MemoryRouter>
        <CreateComplaint />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /submit maintenance report/i }));

    expect(screen.getByText('Complaint title is required.')).toBeInTheDocument();
    expect(screen.getByText('Building or facility name is required.')).toBeInTheDocument();
    expect(screen.getByText('Floor number or level is required.')).toBeInTheDocument();
    expect(screen.getByText('Room or unit designation is required.')).toBeInTheDocument();
    expect(screen.getByText('Detailed description is required.')).toBeInTheDocument();
  });

  it('validates minimum length constraints for title and description', () => {
    render(
      <MemoryRouter>
        <CreateComplaint />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/incident title/i), { target: { value: 'Tiny' } });
    fireEvent.change(screen.getByLabelText(/problem details/i), { target: { value: 'Short' } });
    fireEvent.click(screen.getByRole('button', { name: /submit maintenance report/i }));

    expect(screen.getByText('Title must be between 5 and 120 characters.')).toBeInTheDocument();
    expect(screen.getByText('Description must be at least 10 characters long.')).toBeInTheDocument();
  });

  it('submits valid payload to complaintsApi.create', async () => {
    const createSpy = vi.spyOn(complaintsApi, 'create').mockResolvedValue({
      complaint: { _id: 'new_comp_123', complaintNumber: 'FIX-202610-0001' },
    });

    render(
      <MemoryRouter>
        <CreateComplaint />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/incident title/i), {
      target: { value: 'Broken AC unit in laboratory' },
    });
    fireEvent.change(screen.getByLabelText(/building \/ block/i), {
      target: { value: 'Science Wing' },
    });
    fireEvent.change(screen.getByLabelText(/floor \/ level/i), {
      target: { value: 'Level 2' },
    });
    fireEvent.change(screen.getByLabelText(/room \/ unit/i), {
      target: { value: 'Lab 204' },
    });
    fireEvent.change(screen.getByLabelText(/problem details/i), {
      target: { value: 'The air conditioner is vibrating loudly and blowing warm air.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /submit maintenance report/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        title: 'Broken AC unit in laboratory',
        category: 'electrical',
        priority: 'medium',
        location: {
          building: 'Science Wing',
          floor: 'Level 2',
          roomOrUnit: 'Lab 204',
          additionalNotes: undefined,
        },
        description: 'The air conditioner is vibrating loudly and blowing warm air.',
      });
    });
  });

  it('renders ErrorState banner when API rejects submission', async () => {
    vi.spyOn(complaintsApi, 'create').mockRejectedValue(
      new Error('Server error: database write timeout')
    );

    render(
      <MemoryRouter>
        <CreateComplaint />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/incident title/i), {
      target: { value: 'Sink overflowing' },
    });
    fireEvent.change(screen.getByLabelText(/building \/ block/i), {
      target: { value: 'Hostel A' },
    });
    fireEvent.change(screen.getByLabelText(/floor \/ level/i), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText(/room \/ unit/i), {
      target: { value: '101' },
    });
    fireEvent.change(screen.getByLabelText(/problem details/i), {
      target: { value: 'Water leaking all over bathroom floor.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /submit maintenance report/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Server error: database write timeout')).toBeInTheDocument();
  });
});
