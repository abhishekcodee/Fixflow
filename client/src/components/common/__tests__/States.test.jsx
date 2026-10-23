import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoadingState } from '../LoadingState';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';
import { PageHeader } from '../PageHeader';

describe('UI States & Feedback Components', () => {
  describe('LoadingState', () => {
    it('renders with role status and polite aria-live', () => {
      render(<LoadingState message="Fetching data..." />);
      const statusElement = screen.getByRole('status');
      expect(statusElement).toBeInTheDocument();
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByText('Fetching data...')).toBeInTheDocument();
    });
  });

  describe('EmptyState', () => {
    it('renders icon, title, description, and action button', () => {
      render(
        <EmptyState
          title="No Tickets"
          description="You have no tickets currently."
          icon="📦"
          action={<button>Create Ticket</button>}
        />
      );

      expect(screen.getByText('No Tickets')).toBeInTheDocument();
      expect(screen.getByText('You have no tickets currently.')).toBeInTheDocument();
      expect(screen.getByText('📦')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create ticket/i })).toBeInTheDocument();
    });
  });

  describe('ErrorState', () => {
    it('renders alert message and triggers onRetry callback', () => {
      const handleRetry = vi.fn();
      render(
        <ErrorState
          title="Failed to load"
          message="Connection timed out"
          onRetry={handleRetry}
          retryText="Try Again"
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
      expect(screen.getByText('Connection timed out')).toBeInTheDocument();

      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('PageHeader', () => {
    it('renders title, description, and actions', () => {
      render(
        <PageHeader
          title="Complaints Dashboard"
          description="Manage requests"
          actions={<button>Export</button>}
        />
      );

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Complaints Dashboard');
      expect(screen.getByText('Manage requests')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    });
  });
});
