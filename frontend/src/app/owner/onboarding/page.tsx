'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import {
  Building2,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ArrowRight,
  Home,
  PlusCircle,
  HelpCircle,
  Mail,
  Lock,
} from 'lucide-react';

export default function OwnerOnboardingPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOutAndRegister = async () => {
    setSigningOut(true);
    try {
      await logout();
      router.push('/register?role=OWNER');
    } catch (err) {
      console.error('Failed to logout', err);
      router.push('/register?role=OWNER');
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // View for Authenticated OWNER
  if (user && user.role === 'OWNER') {
    return (
      <div className="bg-background min-h-[75vh] py-12 sm:py-20 flex items-center justify-center">
        <div className="max-w-xl mx-auto px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-light text-primary flex items-center justify-center mx-auto mb-6 shadow-xs">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            You Are an Active Property Owner
          </h1>
          <p className="mt-3 text-muted text-sm leading-relaxed max-w-md mx-auto">
            You are currently signed in with an authorized Owner account. You have full access to list residential
            properties and manage incoming tenant applications.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/owner">
              <Button size="lg" className="w-full sm:w-auto">
                <Home className="h-4 w-4 mr-2" />
                Go to Owner Dashboard
              </Button>
            </Link>
            <Link href="/owner/properties/new">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                <PlusCircle className="h-4 w-4 mr-2" />
                List a New Property
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // View for Authenticated ADMIN
  if (user && user.role === 'ADMIN') {
    return (
      <div className="bg-background min-h-[75vh] py-12 sm:py-20 flex items-center justify-center">
        <div className="max-w-xl mx-auto px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-light text-primary flex items-center justify-center mx-auto mb-6 shadow-xs">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Administrator Account
          </h1>
          <p className="mt-3 text-muted text-sm leading-relaxed max-w-md mx-auto">
            You are currently signed in with platform Administrator privileges. Property listings, verifications,
            and moderation are managed through the dedicated Admin Portal.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/admin">
              <Button size="lg" className="w-full sm:w-auto">
                <ShieldCheck className="h-4 w-4 mr-2" />
                Go to Admin Portal
              </Button>
            </Link>
            <Link href="/properties">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Browse Marketplace
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // View for Authenticated TENANT
  if (user && user.role === 'TENANT') {
    return (
      <div className="bg-background min-h-screen py-10 sm:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-3xl bg-primary-light text-primary flex items-center justify-center mx-auto mb-4 shadow-xs">
              <Building2 className="h-8 w-8" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
              Own a Property? List on RentGoer
            </h1>
            <p className="mt-3 text-base text-muted max-w-xl mx-auto leading-relaxed">
              RentGoer connects property owners directly with verified prospective tenants with zero broker commissions.
            </p>
          </div>

          {/* Account Role Clarification Card */}
          <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-8 shadow-xs mb-8">
            <div className="flex items-start gap-3.5 mb-6 pb-6 border-b border-border/60">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-sm">
                i
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Separate Account Architecture at RentGoer
                </h2>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  You are currently signed in as <strong className="text-foreground">{user.name}</strong> with a{' '}
                  <span className="px-2 py-0.5 rounded-full bg-primary-light text-primary font-semibold text-xs">
                    Tenant Account
                  </span>.
                </p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-muted">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground">Dedicated Roles:</strong> RentGoer maintains distinct account roles
                  for Tenants and Property Owners to provide dedicated dashboards, verification channels, and tailored tools.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground">Owner Dashboard Protection:</strong> A tenant account cannot directly
                  access the Owner Dashboard or list properties.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground">Separate Email Requirement:</strong> Owner registration requires an
                  account with an email address not already registered to an existing tenant account.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground">Your Tenant Data Remains Intact:</strong> Your saved properties,
                  rental requests, and active chats on this tenant account will never be deleted, converted, or overwritten.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground">Easy Owner Setup:</strong> You can sign out and register your dedicated
                  Owner account right now with your secondary or business email address.
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center gap-3 justify-end">
              <Link href="/properties" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Return to Tenant Dashboard
                </Button>
              </Link>
              <Button
                size="lg"
                onClick={handleSignOutAndRegister}
                disabled={signingOut}
                className="w-full sm:w-auto bg-primary text-white hover:bg-primary-hover"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {signingOut ? 'Signing out...' : 'Create Owner Account'}
              </Button>
            </div>
          </div>

          {/* Benefits of Listing on RentGoer */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-card border border-border/70 rounded-xl p-5">
              <div className="h-10 w-10 rounded-xl bg-primary-light text-primary flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-foreground text-sm">100% Direct Renters</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Connect directly with verified prospective tenants looking for homes.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-5">
              <div className="h-10 w-10 rounded-xl bg-primary-light text-primary flex items-center justify-center mx-auto mb-3">
                <Building2 className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-foreground text-sm">Zero Brokerage</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                No middleman commissions. You retain complete control over your lease terms.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-5">
              <div className="h-10 w-10 rounded-xl bg-primary-light text-primary flex items-center justify-center mx-auto mb-3">
                <UserCheck className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-foreground text-sm">Structured Inquiries</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Receive standardized rental requests with budget and move-in timeline details.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // View for Guest Visitors
  return (
    <div className="bg-background min-h-screen py-12 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-light text-primary text-xs font-semibold mb-4">
            <Building2 className="h-4 w-4" />
            <span>RentGoer for Residential Property Owners</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight">
            List Your Property on RentGoer
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
            Connect directly with verified prospective tenants across India. No brokers, no spam, no hidden commissions.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register?role=OWNER" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-primary text-white hover:bg-primary-hover px-8">
                Register as Property Owner
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/login?role=OWNER" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Owner Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Value Prop Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-card border border-border/80 rounded-2xl p-6">
            <div className="h-10 w-10 rounded-xl bg-primary-light text-primary flex items-center justify-center mb-4 font-bold">
              1
            </div>
            <h3 className="text-base font-bold text-foreground">Zero Broker Commissions</h3>
            <p className="text-xs sm:text-sm text-muted mt-2 leading-relaxed">
              Keep 100% of your rental income. RentGoer does not charge commission on your leases.
            </p>
          </div>

          <div className="bg-card border border-border/80 rounded-2xl p-6">
            <div className="h-10 w-10 rounded-xl bg-primary-light text-primary flex items-center justify-center mb-4 font-bold">
              2
            </div>
            <h3 className="text-base font-bold text-foreground">Real-Time In-App Chat</h3>
            <p className="text-xs sm:text-sm text-muted mt-2 leading-relaxed">
              Communicate securely with tenants directly through our private messaging without revealing your phone number publicly.
            </p>
          </div>

          <div className="bg-card border border-border/80 rounded-2xl p-6">
            <div className="h-10 w-10 rounded-xl bg-primary-light text-primary flex items-center justify-center mb-4 font-bold">
              3
            </div>
            <h3 className="text-base font-bold text-foreground">Verified Host Badges</h3>
            <p className="text-xs sm:text-sm text-muted mt-2 leading-relaxed">
              Submit proof of ownership to receive a &quot;Verified Property&quot; badge and stand out to premium prospective tenants.
            </p>
          </div>
        </div>

        {/* Guidelines Link Callout */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-foreground text-sm sm:text-base">Want to review our hosting standards first?</h4>
            <p className="text-xs sm:text-sm text-muted mt-1">
              Read our full Direct Lease Guidelines covering pricing, photography, and written lease best practices.
            </p>
          </div>
          <Link href="/guidelines#owner-guidelines" className="text-primary font-semibold text-sm hover:underline flex-shrink-0">
            Read Owner Guidelines &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

