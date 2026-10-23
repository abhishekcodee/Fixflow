import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../Input';

describe('Input Component', () => {
  it('renders label, input, and links them via id', () => {
    render(<Input id="test-email" name="email" label="Email Address" />);
    const label = screen.getByText(/email address/i);
    const input = screen.getByLabelText(/email address/i);
    expect(label).toHaveAttribute('for', 'test-email');
    expect(input).toHaveAttribute('id', 'test-email');
  });

  it('renders required indicator when required is true', () => {
    render(<Input name="username" label="Username" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeRequired();
  });

  it('displays error message and sets aria-invalid', () => {
    render(<Input name="email" label="Email" error="Invalid email address" />);
    const input = screen.getByRole('textbox');
    const errorMsg = screen.getByRole('alert');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(errorMsg).toHaveTextContent('Invalid email address');
  });

  it('handles user input change events', () => {
    const handleChange = vi.fn();
    render(<Input name="title" label="Title" onChange={handleChange} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'Leaking pipe' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('renders helper text when no error is present', () => {
    render(<Input name="code" label="Code" helperText="Enter 6-digit pin" />);
    expect(screen.getByText('Enter 6-digit pin')).toBeInTheDocument();
  });
});
