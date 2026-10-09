import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface PaginationProps {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
}

export const Pagination = ({ page, totalPages, searchParams }: PaginationProps) => {
  if (totalPages <= 1) return null;

  const createPageUrl = (pageNumber: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    });
    params.set('page', pageNumber.toString());
    return `/properties?${params.toString()}`;
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    let start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  };

  return (
    <div className="flex justify-center items-center gap-2 mt-12">
      {page > 1 ? (
        <Link href={createPageUrl(page - 1)}>
          <Button variant="outline">Previous</Button>
        </Link>
      ) : (
        <Button variant="outline" disabled>Previous</Button>
      )}

      {getPageNumbers().map(p => (
        <Link key={p} href={createPageUrl(p)}>
          <Button variant={page === p ? 'primary' : 'outline'}>
            {p}
          </Button>
        </Link>
      ))}

      {page < totalPages ? (
        <Link href={createPageUrl(page + 1)}>
          <Button variant="outline">Next</Button>
        </Link>
      ) : (
        <Button variant="outline" disabled>Next</Button>
      )}
    </div>
  );
};
