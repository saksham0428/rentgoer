'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Heart } from 'lucide-react';

export const Footer = () => {
  const pathname = usePathname();

  // Do not render marketing footer on chat pages to preserve fixed full-height app viewport
  if (pathname?.startsWith('/chat')) {
    return null;
  }

  return (
    <footer className="bg-card border-t border-border/80 mt-auto transition-colors">
      <div className="max-w-7xl mx-auto pt-16 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">

          <div className="md:col-span-4 flex flex-col items-start">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <span className="text-2xl font-black text-primary tracking-tight">
                RentGoer
              </span>
            </Link>
            <p className="mt-3.5 text-sm text-muted max-w-sm leading-relaxed">
              Find your place. Skip the broker. The modern direct rental marketplace connecting tenants and verified property owners.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-light text-primary text-xs font-semibold">
              <ShieldCheck className="h-4 w-4" />
              <span>100% Direct & Verified Marketplace</span>
            </div>
          </div>

          <div className="md:col-span-2">
            <h3 className="text-xs font-bold text-foreground tracking-wider uppercase">Marketplace</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/properties" className="text-sm text-muted hover:text-primary transition-colors">
                  Browse Properties
                </Link>
              </li>
              <li>
                <Link href="/favorites" className="text-sm text-muted hover:text-primary transition-colors">
                  Saved Properties
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-xs font-bold text-foreground tracking-wider uppercase">For Owners</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/register?role=OWNER" className="text-sm text-muted hover:text-primary transition-colors">
                  List a Property
                </Link>
              </li>
              <li>
                <Link href="/owner" className="text-sm text-muted hover:text-primary transition-colors">
                  Owner Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-xs font-bold text-foreground tracking-wider uppercase">Trust & Legal</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <span className="text-sm text-muted cursor-default">Direct Lease Guidelines</span>
              </li>
              <li>
                <span className="text-sm text-muted cursor-default">Privacy Policy</span>
              </li>
              <li>
                <span className="text-sm text-muted cursor-default">Terms of Service</span>
              </li>
            </ul>
          </div>

        </div>

        <div className="mt-12 pt-8 border-t border-border/60 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted">
          <p>
            &copy; {new Date().getFullYear()} RentGoer. All rights reserved. Zero brokerage, transparent direct rentals.
          </p>
          <div className="flex items-center gap-1 text-muted">
            <span>Built for modern renting</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
