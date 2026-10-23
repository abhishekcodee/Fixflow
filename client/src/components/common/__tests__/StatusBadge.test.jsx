import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge Component', () => {
  it('renders status badges with appropriate labels and classes', () => {
    const { rerender } = render(<StatusBadge status="submitted" />);
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Submitted').closest('.badge')).toHaveClass('badge--status-submitted');

    rerender(<StatusBadge status="in_progress" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('In Progress').closest('.badge')).toHaveClass('badge--status-in-progress');

    rerender(<StatusBadge status="resolved" />);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('Resolved').closest('.badge')).toHaveClass('badge--status-resolved');
  });

  it('renders priority badges with appropriate labels and classes', () => {
    const { rerender } = render(<StatusBadge priority="urgent" variant="priority" />);
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('Urgent').closest('.badge')).toHaveClass('badge--priority-urgent');

    rerender(<StatusBadge priority="low" variant="priority" />);
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Low').closest('.badge')).toHaveClass('badge--priority-low');
  });

  it('falls back to neutral styling for unknown statuses', () => {
    render(<StatusBadge status="unknown_status" />);
    expect(screen.getByText('unknown_status')).toBeInTheDocument();
    expect(screen.getByText('unknown_status').closest('.badge')).toHaveClass('badge--neutral');
  });
});
