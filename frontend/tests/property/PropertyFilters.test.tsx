import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyFilters } from '@/components/property/PropertyFilters';

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

describe('PropertyFilters component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('initializes filter inputs with default values when searchParams are empty', () => {
    render(<PropertyFilters />);

    const cityInput = screen.getByPlaceholderText(/city\.\.\./i) as HTMLInputElement;
    const localityInput = screen.getByPlaceholderText(/locality\.\.\./i) as HTMLInputElement;

    expect(cityInput.value).toBe('');
    expect(localityInput.value).toBe('');
    expect(screen.queryByText(/advanced filters/i)).not.toBeInTheDocument();
  });

  it('initializes filter inputs from URL search parameters', () => {
    mockSearchParams = new URLSearchParams({
      city: 'Bengaluru',
      locality: 'Indiranagar',
      sortBy: 'rent_asc',
    });

    render(<PropertyFilters />);

    const cityInput = screen.getByPlaceholderText(/city\.\.\./i) as HTMLInputElement;
    const localityInput = screen.getByPlaceholderText(/locality\.\.\./i) as HTMLInputElement;

    expect(cityInput.value).toBe('Bengaluru');
    expect(localityInput.value).toBe('Indiranagar');
  });

  it('submits quick search form and updates URL parameters', () => {
    render(<PropertyFilters />);

    const cityInput = screen.getByPlaceholderText(/city\.\.\./i);
    const localityInput = screen.getByPlaceholderText(/locality\.\.\./i);
    const searchBtn = screen.getByRole('button', { name: /^search$/i });

    fireEvent.change(cityInput, { target: { value: 'Mumbai' } });
    fireEvent.change(localityInput, { target: { value: 'Bandra' } });
    fireEvent.click(searchBtn);

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/properties?'));
    const url = mockPush.mock.calls[0][0];
    expect(url).toContain('city=Mumbai');
    expect(url).toContain('locality=Bandra');
  });

  it('auto-applies sort order change to the URL', () => {
    render(<PropertyFilters />);

    const sortSelect = screen.getByDisplayValue(/newest first/i);
    fireEvent.change(sortSelect, { target: { value: 'rent_desc' } });

    expect(mockPush).toHaveBeenCalledWith('/properties?sortBy=rent_desc');
  });

  it('toggles the advanced filters panel open and closed', () => {
    render(<PropertyFilters />);

    const toggleBtn = screen.getByRole('button', { name: /more filters/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText('Advanced Filters')).toBeInTheDocument();
    expect(screen.getByLabelText(/min rent/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/max rent/i)).toBeInTheDocument();

    // Close via X button
    const closeBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Advanced Filters')).not.toBeInTheDocument();
  });

  it('applies advanced filters and includes all selected criteria in URL', () => {
    render(<PropertyFilters />);

    // Open advanced filters
    fireEvent.click(screen.getByRole('button', { name: /more filters/i }));

    fireEvent.change(screen.getByLabelText(/min rent/i), { target: { value: '15000' } });
    fireEvent.change(screen.getByLabelText(/max rent/i), { target: { value: '45000' } });
    fireEvent.change(screen.getByLabelText(/bedrooms/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/property type/i), { target: { value: 'APARTMENT' } });
    fireEvent.change(screen.getByLabelText(/furnishing/i), { target: { value: 'FURNISHED' } });

    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const url = mockPush.mock.calls[0][0];
    expect(url).toContain('minRent=15000');
    expect(url).toContain('maxRent=45000');
    expect(url).toContain('bedrooms=2');
    expect(url).toContain('propertyType=APARTMENT');
    expect(url).toContain('furnishedStatus=FURNISHED');
    expect(screen.queryByText('Advanced Filters')).not.toBeInTheDocument();
  });

  it('clears all filters and resets URL to /properties', () => {
    mockSearchParams = new URLSearchParams({
      city: 'Delhi',
      locality: 'Saket',
      minRent: '20000',
    });

    render(<PropertyFilters />);

    // Open advanced panel to access "Clear All"
    fireEvent.click(screen.getByRole('button', { name: /more filters/i }));

    const clearBtn = screen.getByRole('button', { name: /clear all/i });
    fireEvent.click(clearBtn);

    expect(mockPush).toHaveBeenCalledWith('/properties');
    expect(screen.queryByText('Advanced Filters')).not.toBeInTheDocument();
  });
});
