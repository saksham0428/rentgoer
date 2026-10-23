import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@/components/ui/Input';

describe('Input component', () => {
  it('renders input with placeholder and type', () => {
    render(<Input placeholder="Enter your email" type="email" />);
    const input = screen.getByPlaceholderText('Enter your email');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'email');
  });

  it('renders label and links it to the input via id', () => {
    render(<Input label="Username" id="user-input" />);
    const label = screen.getByText('Username');
    const input = screen.getByLabelText('Username');
    expect(label).toBeInTheDocument();
    expect(input).toHaveAttribute('id', 'user-input');
  });

  it('generates a fallback id if none is provided', () => {
    render(<Input label="Auto ID Field" />);
    const input = screen.getByLabelText('Auto ID Field');
    expect(input.id).toBeTruthy();
  });

  it('handles user typing and change events', () => {
    const handleChange = vi.fn();
    render(<Input placeholder="Type here" onChange={handleChange} />);
    const input = screen.getByPlaceholderText('Type here');

    fireEvent.change(input, { target: { value: 'RentGoer' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('displays error message and applies error styling when error is present', () => {
    render(<Input label="Password" error="Password is required" />);
    expect(screen.getByText('Password is required')).toBeInTheDocument();

    const input = screen.getByLabelText('Password');
    expect(input).toHaveClass('border-danger');
  });

  it('forwards ref to the underlying HTML input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} defaultValue="Test" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.value).toBe('Test');
  });
});
