'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const Footer = () => {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Do not render marketing footer on chat pages to preserve fixed full-height app viewport
  if (pathname?.startsWith('/chat')) {
    return null;
  }

  return (
    <footer className="bg-card border-t border-border/80 mt-auto transition-colors">
      <div className="max-w-7xl mx-auto pt-16 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">

          {/* Brand Col */}
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

          {/* Marketplace Col */}
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
              {user?.role === 'TENANT' && (
                <li>
                  <Link href="/rental-requests" className="text-sm text-muted hover:text-primary transition-colors">
                    My Rental Requests
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Role-Aware Column */}
          <div className="md:col-span-3">
            {loading ? (
              // Neutral loading fallback to prevent hydration mismatch and avoid role leakage flash
              <div>
                <h3 className="text-xs font-bold text-foreground tracking-wider uppercase">For Owners</h3>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href="/owner/onboarding" className="text-sm text-muted hover:text-primary transition-colors">
                      List Your Property
                    </Link>
                  </li>
                  <li>
                    <Link href="/guidelines#owner-guidelines" className="text-sm text-muted hover:text-primary transition-colors">
                      Owner Guidelines
                    </Link>
                  </li>
                </ul>
              </div>
            ) : !user ? (
              // Case A: Guest Visitor
              <div>
                <h3 className="text-xs font-bold text-foreground tracking-wider uppercase">For Owners</h3>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href="/register?role=OWNER" className="text-sm text-muted hover:text-primary transition-colors">
                      List Your Property
                    </Link>
                  </li>
                  <li>
                    <Link href="/login?role=OWNER" className="text-sm text-muted hover:text-primary transition-colors">
                      Owner Sign In
                    </Link>
                  </li>
                  <li>
                    <Link href="/owner/onboarding" className="text-sm text-muted hover:text-primary transition-colors">
                      Owner Overview
                    </Link>
                  </li>
                </ul>
              </div>
            ) : user.role === 'TENANT' ? (
              // Case B: Authenticated TENANT -> Dedicated Owner Invitation Card (No Owner Dashboard link)
              <div className="bg-muted-light/60 border border-border/80 rounded-xl p-4.5">
                <h3 className="text-xs font-bold text-foreground tracking-wider uppercase">
                  Own a property?
                </h3>
                <p className="mt-2 text-xs text-muted leading-relaxed">
                  List your property on RentGoer and connect directly with prospective tenants.
                </p>
                <div className="mt-3.5">
                  <Link
                    href="/owner/onboarding"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-2xs"
                  >
                    <span>Become a Property Owner</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ) : user.role === 'OWNER' ? (
              // Case C: Authenticated OWNER
              <div>
                <h3 className="text-xs font-bold text-foreground tracking-wider uppercase">Owner Management</h3>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href="/owner/properties/new" className="text-sm text-muted hover:text-primary transition-colors">
                      List a Property
                    </Link>
                  </li>
                  <li>
                    <Link href="/owner" className="text-sm text-muted hover:text-primary transition-colors">
                      Owner Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/owner/properties" className="text-sm text-muted hover:text-primary transition-colors">
                      Manage Listings
                    </Link>
                  </li>
                  <li>
                    <Link href="/owner/requests" className="text-sm text-muted hover:text-primary transition-colors">
                      Rental Requests
                    </Link>
                  </li>
                </ul>
              </div>
            ) : user.role === 'ADMIN' ? (
              // Case D: ADMIN
              <div>
                <h3 className="text-xs font-bold text-foreground tracking-wider uppercase">Administration</h3>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href="/admin" className="text-sm text-muted hover:text-primary transition-colors">
                      Admin Portal
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin/reports" className="text-sm text-muted hover:text-primary transition-colors">
                      Platform Reports
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin/verification" className="text-sm text-muted hover:text-primary transition-colors">
                      Verification Queue
                    </Link>
                  </li>
                </ul>
              </div>
            ) : null}
          </div>

          {/* Trust & Legal Col (All 4 Links Active) */}
          <div className="md:col-span-3">
            <h3 className="text-xs font-bold text-foreground tracking-wider uppercase">Trust & Legal</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/guidelines" className="text-sm text-muted hover:text-primary transition-colors">
                  Direct Lease Guidelines
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-muted hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-muted hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-muted hover:text-primary transition-colors">
                  Contact & Grievances
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Footer Bottom */}
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
