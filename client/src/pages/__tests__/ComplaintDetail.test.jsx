import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ComplaintDetail } from '../ComplaintDetail';
import { complaintsApi } from '../../services/api';
import * as authContext from '../../context/AuthContext';

describe('ComplaintDetail Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockComplaint = {
    _id: 'comp_detail_1',
    complaintNumber: 'FIX-202610-0042',
    title: 'HVAC chilling failure',
    description: 'Server room temperature rising above 26C.',
    category: 'hvac',
    priority: 'urgent',
    status: 'assigned',
    location: {
      building: 'Data Center 1',
      floor: 'Basement',
      roomOrUnit: 'Rack Bay 3',
      additionalNotes: 'Requires badge clearance',
    },
    createdBy: { _id: 'u_creator', name: 'DevOps Lead', email: 'devops@fixflow.com' },
    assignedTo: { _id: 'tech_tom', name: 'Tom Fixer', email: 'tom@fixflow.com' },
    createdAt: '2026-10-23T11:00:00.000Z',
  };

  const mockHistory = [
    {
      _id: 'hist_1',
      action: 'created',
      performedBy: { name: 'DevOps Lead' },
      createdAt: '2026-10-23T11:00:00.000Z',
    },
    {
      _id: 'hist_2',
      action: 'assigned',
      performedBy: { name: 'Admin Alice' },
      previousState: 'submitted',
      newState: 'assigned',
      note: 'Dispatched on priority call',
      createdAt: '2026-10-23T11:15:00.000Z',
    },
  ];

  it('renders complaint details, location, and activity history', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'u_creator', role: 'user' },
    });
    vi.spyOn(complaintsApi, 'getById').mockResolvedValue({ complaint: mockComplaint });
    vi.spyOn(complaintsApi, 'getHistory').mockResolvedValue({ history: mockHistory });

    render(
      <MemoryRouter initialEntries={['/complaints/comp_detail_1']}>
        <Routes>
          <Route path="/complaints/:id" element={<ComplaintDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('FIX-202610-0042: HVAC chilling failure')).toBeInTheDocument();
    expect(screen.getByText('Server room temperature rising above 26C.')).toBeInTheDocument();
    expect(screen.getByText('Data Center 1')).toBeInTheDocument();
    expect(screen.getByText('Floor Basement, Unit Rack Bay 3')).toBeInTheDocument();
    expect(screen.getByText('Requires badge clearance')).toBeInTheDocument();
    expect(screen.getByText('Tom Fixer')).toBeInTheDocument();
    expect(screen.getByText('"Dispatched on priority call"')).toBeInTheDocument();
  });

  it('allows assigned technician to advance status from assigned to in_progress', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'tech_tom', role: 'technician' },
    });
    vi.spyOn(complaintsApi, 'getById').mockResolvedValue({ complaint: mockComplaint });
    vi.spyOn(complaintsApi, 'getHistory').mockResolvedValue({ history: mockHistory });
    const statusSpy = vi.spyOn(complaintsApi, 'updateStatus').mockResolvedValue({ success: true });

    render(
      <MemoryRouter initialEntries={['/complaints/comp_detail_1']}>
        <Routes>
          <Route path="/complaints/:id" element={<ComplaintDetail />} />
        </Routes>
      </MemoryRouter>
    );

    const startWorkBtn = await screen.findByRole('button', { name: /start work/i });
    fireEvent.click(startWorkBtn);

    expect(screen.getByText('Update Status: IN PROGRESS')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /confirm transition/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(statusSpy).toHaveBeenCalledWith('comp_detail_1', {
        status: 'in_progress',
        note: undefined,
      });
    });
  });

  it('renders ErrorState when complaint fails to load', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'u_creator', role: 'user' },
    });
    vi.spyOn(complaintsApi, 'getById').mockRejectedValue(new Error('Complaint not found'));

    render(
      <MemoryRouter initialEntries={['/complaints/bad_id']}>
        <Routes>
          <Route path="/complaints/:id" element={<ComplaintDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Complaint Unavailable')).toBeInTheDocument();
  });

  it('allows creator to submit resolution feedback on a resolved ticket', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'u_creator', role: 'user' },
    });

    const resolvedComplaint = {
      ...mockComplaint,
      status: 'resolved',
      feedback: null,
    };

    vi.spyOn(complaintsApi, 'getById').mockResolvedValue({ complaint: resolvedComplaint });
    vi.spyOn(complaintsApi, 'getHistory').mockResolvedValue({ history: mockHistory });
    const feedbackSpy = vi.spyOn(complaintsApi, 'submitFeedback').mockResolvedValue({
      complaint: { ...resolvedComplaint, feedback: { rating: 5, comments: 'Great repair!' } },
    });

    render(
      <MemoryRouter initialEntries={['/complaints/comp_detail_1']}>
        <Routes>
          <Route path="/complaints/:id" element={<ComplaintDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Resolution Feedback & Rating')).toBeInTheDocument();
    expect(screen.getByLabelText(/service satisfaction rating/i)).toBeInTheDocument();

    const commentsInput = screen.getByLabelText(/comments \/ repair quality review/i);
    fireEvent.change(commentsInput, { target: { value: 'Great repair!' } });

    const submitFeedbackBtn = screen.getByRole('button', { name: /submit feedback/i });
    fireEvent.click(submitFeedbackBtn);

    await waitFor(() => {
      expect(feedbackSpy).toHaveBeenCalledWith('comp_detail_1', {
        rating: 5,
        comments: 'Great repair!',
      });
    });
  });

  it('renders existing feedback rating and comments when present on closed ticket', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'u_creator', role: 'user' },
    });

    const closedWithFeedback = {
      ...mockComplaint,
      status: 'closed',
      feedback: {
        rating: 5,
        comments: 'Prompt service and thoroughly tested HVAC.',
        submittedAt: '2026-10-23T14:00:00.000Z',
      },
    };

    vi.spyOn(complaintsApi, 'getById').mockResolvedValue({ complaint: closedWithFeedback });
    vi.spyOn(complaintsApi, 'getHistory').mockResolvedValue({ history: mockHistory });

    render(
      <MemoryRouter initialEntries={['/complaints/comp_detail_1']}>
        <Routes>
          <Route path="/complaints/:id" element={<ComplaintDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/prompt service and thoroughly tested hvac/i)).toBeInTheDocument();
    expect(screen.getByText('(5 / 5)')).toBeInTheDocument();
    expect(screen.getByText('✔ Service Verified')).toBeInTheDocument();
  });
});

