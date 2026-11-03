import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Scale, FileCheck, AlertTriangle, ShieldCheck, HelpCircle, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service | RentGoer',
  description:
    'Platform terms of service and marketplace conditions governing the use of RentGoer by prospective tenants and residential property owners.',
};

export default function TermsOfServicePage() {
  return (
    <div className="bg-background min-h-screen py-10 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Link href="/" className="hover:underline">Home</Link>
          <span>/</span>
          <span>Trust & Safety</span>
          <span>/</span>
          <span className="text-muted">Terms of Service</span>
        </div>

        {/* Hero Title */}
        <div className="border-b border-border/80 pb-8 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-light text-primary text-xs font-semibold mb-4">
            <Scale className="h-4 w-4" />
            <span>Marketplace Terms & Conditions</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted max-w-3xl leading-relaxed">
            Please read these Terms of Service carefully before accessing or using the RentGoer platform. These terms define
            the legal relationship between you and RentGoer regarding your use of our direct rental discovery and communication
            services.
          </p>
          <div className="mt-4 text-xs font-medium text-muted">
            Last Updated: November 2026 &bull; Drafted for Indian Legal Framework &bull; Version 1.2
          </div>
        </div>

        {/* Important Marketplace Disclaimer Banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 sm:p-8 mb-12">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-bold text-foreground">Marketplace Nature & Role Definition</h2>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                RentGoer is a neutral digital matchmaking platform that connects residential property owners directly with
                prospective tenants. RentGoer is <strong>not a real estate broker, property manager, landlord, tenant representative,
                escrow agent, or payment processor</strong>. We do not own, inspect, lease, manage, or insure listed properties,
                nor do we guarantee the financial solvency, character, or performance of any tenant or owner.
              </p>
            </div>
          </div>
        </div>

        {/* Table of Contents */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 mb-12 shadow-2xs">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-4">Table of Contents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <a href="#acceptance" className="text-primary hover:underline">1. Acceptance of Terms</a>
            <a href="#eligibility" className="text-primary hover:underline">2. Eligibility & Registration</a>
            <a href="#marketplace-scope" className="text-primary hover:underline">3. Marketplace Scope & Limitations</a>
            <a href="#tenant-obligations" className="text-primary hover:underline">4. Tenant Obligations & Conduct</a>
            <a href="#owner-obligations" className="text-primary hover:underline">5. Property Owner Obligations & Listing Rules</a>
            <a href="#rental-requests" className="text-primary hover:underline">6. Rental Requests & Direct Chat</a>
            <a href="#verification-limits" className="text-primary hover:underline">7. Verification Badge Scope & Limits</a>
            <a href="#prohibited-activities" className="text-primary hover:underline">8. Prohibited Activities</a>
            <a href="#reviews-moderation" className="text-primary hover:underline">9. Reviews, Reports & Moderation</a>
            <a href="#lease-contracts" className="text-primary hover:underline">10. Independent Lease Agreements</a>
            <a href="#liability" className="text-primary hover:underline">11. Disclaimers & Limitation of Liability</a>
            <a href="#suspension" className="text-primary hover:underline">12. Account Suspension & Termination</a>
            <a href="#governing-law" className="text-primary hover:underline">13. Governing Law & Dispute Jurisdiction</a>
            <a href="#grievance-contact" className="text-primary hover:underline">14. Grievance Redressal & Intermediary Compliance</a>
          </div>
        </div>

        {/* 1. Acceptance */}
        <section id="acceptance" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground mb-3">1. Acceptance of Terms</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-2">
            <p>
              By visiting, registering for, browsing, or utilizing any feature of the RentGoer website or mobile interface,
              you agree to be legally bound by these Terms of Service and our{' '}
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. If you do not agree to these
              terms, you must immediately cease accessing the platform.
            </p>
          </div>
        </section>

        {/* 2. Eligibility */}
        <section id="eligibility" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground mb-3">2. Eligibility & Account Registration</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>
              You must be at least 18 years old and capable of forming a legally binding contract under the Indian Contract Act,
              1872 to use RentGoer.
            </p>
            <p>
              When creating an account, you agree to provide truthful, accurate, and current information. You are solely
              responsible for maintaining the confidentiality of your password and credentials. You must immediately notify
              RentGoer if you suspect any unauthorized access to your account.
            </p>
          </div>
        </section>

        {/* 3. Marketplace Scope */}
        <section id="marketplace-scope" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground mb-3">3. Marketplace Scope & Limitations</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>
              RentGoer serves strictly as a digital venue facilitating communications between independent property owners and
              prospective renters. RentGoer does not:
            </p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Participate in property showings, negotiations, or lease contract drafting.</li>
              <li>Act as a broker, agent, or intermediary under the Real Estate (Regulation and Development) Act, 2016 (RERA) or state real estate regulations.</li>
              <li>Hold security deposits, collect rent, or maintain an escrow account.</li>
              <li>Guarantee that any listed property is vacant, structurally sound, legally cleared, or free of encumbrances.</li>
            </ul>
          </div>
        </section>

        {/* 4. Tenant Obligations */}
        <section id="tenant-obligations" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground mb-3">4. Tenant Obligations & Conduct</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>As a prospective tenant, you agree to:</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Personally inspect any property before transferring advance tokens, deposits, or rent.</li>
              <li>Verify the identity and title/ownership documents of the property owner prior to executing an agreement.</li>
              <li>Use the chat system respectfully and solely for bona fide residential rental inquiries.</li>
              <li>Fulfill all commitments made in any bilateral rental agreement executed with a property owner.</li>
            </ul>
          </div>
        </section>

        {/* 5. Owner Obligations */}
        <section id="owner-obligations" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground mb-3">5. Property Owner Obligations & Listing Rules</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>As a property owner listing premises on RentGoer, you represent and warrant that:</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>You are the lawful legal owner of the premises or hold valid, written authorization/Power of Attorney to lease the property.</li>
              <li>All listing photographs are authentic, recent, and accurately depict the property offered.</li>
              <li>The property complies with local municipal health, safety, and fire standards.</li>
              <li>You will not charge prospective tenants fees or advance payments merely to inspect the premises.</li>
              <li>You will not discriminate unlawfully against prospective tenants on grounds of religion, race, caste, sex, or place of birth.</li>
            </ul>
          </div>
        </section>

        {/* 6. Rental Requests & Direct Chat */}
        <section id="rental-requests" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground mb-3">6. Rental Requests & Direct Chat</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>
              RentGoer provides in-app rental request workflows and direct chat messaging. Communications must remain
              professional and focused on property rental details. Users must not use platform chat to distribute spam,
              phishing links, malicious code, or unsolicited commercial advertisements.
            </p>
          </div>
        </section>

        {/* 7. Verification Badge Scope */}
        <section id="verification-limits" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground mb-3">7. Verification Badge Scope & Limits</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>
              A &quot;Verified Owner&quot; or &quot;Verified Property&quot; badge indicates that the user or property submitted documentation
              (such as identity proof or utility records) that passed preliminary visual review by RentGoer moderators.
            </p>
            <p>
              <strong>The badge does NOT constitute:</strong> A legal certification of title, a guarantee against fraud, a
              structural inspection certification, or an insurance policy. Tenants remain legally responsible for their own
              in-person physical due diligence.
            </p>
          </div>
        </section>

        {/* 8. Prohibited Activities */}
        <section id="prohibited-activities" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground mb-3">8. Prohibited Activities</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-2">
            <p>The following activities are strictly prohibited and result in immediate termination and referral to law enforcement:</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Posting fictitious, duplicate, or bait-and-switch property listings.</li>
              <li>Demanding &quot;gate pass&quot;, &quot;visiting pass&quot;, or online advance fees before property inspection.</li>
              <li>Harassing, threatening, or sending defamatory messages to other users.</li>
              <li>Attempting to probe, scan, breach, or tamper with RentGoer security infrastructure, APIs, or database systems.</li>
              <li>Automated scraping, crawling, or extracting platform data without explicit written consent.</li>
            </ul>
          </div>
        </section>

        {/* 9. Reviews & Moderation */}
        <section id="reviews-moderation" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground mb-3">9. Reviews, Reports & Moderation</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>
              Users may submit reviews and ratings based on genuine rental experiences. RentGoer reserves the right to review,
              screen, or remove reviews that contain abusive language, hate speech, personally identifiable information, or
              proven factual falsehoods.
            </p>
          </div>
        </section>

        {/* 10. Independent Lease Agreements */}
        <section id="lease-contracts" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground mb-3">10. Independent Lease Agreements</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>
              Any rental agreement, leave and license agreement, or lease contract executed between a tenant and an owner is a
              private, independent bilateral contract. RentGoer is not a party to such contracts and disclaims all liability
              arising from contractual disputes, lease violations, maintenance issues, non-payment of rent, or deposit refund
              withholding.
            </p>
          </div>
        </section>

        {/* 11. Limitation of Liability */}
        <section id="liability" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground mb-3">11. Disclaimers & Limitation of Liability</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE LAW, RENTGOER AND ITS OPERATORS, DIRECTORS, AND EMPLOYEES
              PROVIDE THE PLATFORM ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.
            </p>
            <p>
              IN NO EVENT SHALL RENTGOER BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
              INCLUDING LOSS OF PROFITS, DATA, USE, GOODWILL, OR PROPERTY LOSS ARISING OUT OF YOUR USE OF THE PLATFORM OR
              TRANSACTIONS ENTERED INTO WITH OTHER USERS.
            </p>
          </div>
        </section>

        {/* 12. Suspension & Termination */}
        <section id="suspension" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground mb-3">12. Account Suspension & Termination</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>
              RentGoer reserves the right to suspend, terminate, or restrict access to any user account or remove any listing
              immediately, with or without notice, if we reasonably determine that the user has violated these Terms, engaged
              in fraudulent activity, or posed a security risk to the community.
            </p>
          </div>
        </section>

        {/* 13. Governing Law */}
        <section id="governing-law" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground mb-3">13. Governing Law & Dispute Jurisdiction</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of India. Any legal dispute, claim,
              or controversy arising under these Terms shall be subject to the exclusive jurisdiction of the competent courts
              in India.
            </p>
          </div>
        </section>

        {/* 14. Grievance Contact */}
        <section id="grievance-contact" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground mb-3">14. Grievance Redressal & Intermediary Compliance</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>
              In compliance with Section 79 of the Information Technology Act, 2000, Rule 3(2) of the Information
              Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and Rule 5 of the Consumer
              Protection (E-Commerce) Rules, 2020, RentGoer designates a dedicated Grievance Officer and maintains a formal
              redressal mechanism.
            </p>
            <p>
              Grievances are acknowledged within 48 hours and redressed within 30 days. Full escalation procedures and
              officer contact details are detailed on our{' '}
              <Link href="/contact" className="text-primary font-semibold hover:underline">Contact & Grievances</Link> page.
            </p>
          </div>
        </section>

        {/* Footer Navigation Back to Legal Pages */}
        <div className="pt-8 border-t border-border/80 flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-4">
            <Link href="/guidelines" className="hover:text-primary transition-colors">Direct Lease Guidelines</Link>
            <span>&bull;</span>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <span>&bull;</span>
            <Link href="/contact" className="hover:text-primary transition-colors">Contact & Grievances</Link>
          </div>
          <div>
            <Link href="/" className="text-primary font-semibold hover:underline">
              Return to RentGoer Home &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

