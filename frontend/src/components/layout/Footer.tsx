'use client';

import React from 'react';
import Link from 'next/link';

export const Footer = () => {
  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <span className="text-2xl font-bold text-primary tracking-tight">RentGoer</span>
            <p className="mt-4 text-sm text-muted">
              Find your place. Skip the broker. The modern direct rental marketplace.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-wider uppercase">Marketplace</h3>
            <ul className="mt-4 space-y-4">
              <li>
                <Link href="/properties" className="text-base text-muted hover:text-primary">
                  Browse Properties
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-wider uppercase">Support</h3>
            <ul className="mt-4 space-y-4">
              <li>
                <span className="text-base text-muted">Help Center</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-wider uppercase">Legal</h3>
            <ul className="mt-4 space-y-4">
              <li>
                <span className="text-base text-muted">Privacy Policy</span>
              </li>
              <li>
                <span className="text-base text-muted">Terms of Service</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-border pt-8">
          <p className="text-base text-muted xl:text-center">
            &copy; {new Date().getFullYear()} RentGoer. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
