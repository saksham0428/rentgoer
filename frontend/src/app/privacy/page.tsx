import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Shield, Lock, Eye, Database, Server, UserCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { legalConfig } from '@/config/legal.config';

export const metadata: Metadata = {
  title: 'Privacy Policy | RentGoer',
  description:
    'Detailed disclosure of how RentGoer collects, handles, stores, and protects personal data in compliance with India’s Digital Personal Data Protection standards.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-background min-h-screen py-10 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Link href="/" className="hover:underline">Home</Link>
          <span>/</span>
          <span>Trust & Safety</span>
          <span>/</span>
          <span className="text-muted">Privacy Policy</span>
        </div>

        {/* Hero Title */}
        <div className="border-b border-border/80 pb-8 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-light text-primary text-xs font-semibold mb-4">
            <Shield className="h-4 w-4" />
            <span>Data Transparency & Privacy Disclosure</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted max-w-3xl leading-relaxed">
            RentGoer values your trust. This Privacy Policy outlines with complete technical and operational transparency
            what personal data we collect, why we collect it, how it is stored, who can see it, and how you can exercise
            your privacy rights.
          </p>
          <div className="mt-4 text-xs font-medium text-muted">
            Last Updated: November 2026 &bull; Effective for all RentGoer users &bull; Applicable under Indian Law
          </div>
        </div>

        {/* Table of Contents */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 mb-12 shadow-2xs">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-4">Contents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <a href="#data-collected" className="text-primary hover:underline">1. Categories of Personal Data Collected</a>
            <a href="#purpose" className="text-primary hover:underline">2. Purpose of Data Processing</a>
            <a href="#visibility" className="text-primary hover:underline">3. Information Visibility & Sharing</a>
            <a href="#auth-sessions" className="text-primary hover:underline">4. Authentication & Technical Metadata</a>
            <a href="#media-storage" className="text-primary hover:underline">5. Property Photos & Object Storage</a>
            <a href="#messaging-notifications" className="text-primary hover:underline">6. Chat & Real-Time Notifications</a>
            <a href="#infrastructure" className="text-primary hover:underline">7. Cloud Infrastructure & Service Providers</a>
            <a href="#retention-deletion" className="text-primary hover:underline">8. Data Retention & Account Deletion Requests</a>
            <a href="#dpdp-rights" className="text-primary hover:underline">9. Your Rights under India&apos;s DPDP Act</a>
            <a href="#policy-updates" className="text-primary hover:underline">10. Policy Updates & Grievances</a>
          </div>
        </div>

        {/* 1. Data Collected */}
        <section id="data-collected" className="mb-14 scroll-mt-24">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <span>1. Categories of Personal Data Collected</span>
          </h2>
          <p className="text-sm text-muted leading-relaxed mb-6">
            RentGoer collects only the data categories genuinely required to operate a direct residential rental marketplace.
            Based on our technical implementation, the collected data includes:
          </p>

          <div className="space-y-4">
            <div className="bg-card border border-border/70 rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground">A. Account & Profile Credentials</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted list-disc list-inside">
                <li><strong>Full Name</strong> (provided during registration or profile update).</li>
                <li><strong>Email Address</strong> (used for authentication and account verification).</li>
                <li><strong>Password Hash</strong> (cryptographically salted and hashed using bcrypt with 10 salt rounds; plaintext passwords are never captured or stored).</li>
                <li><strong>Account Role</strong> (differentiating <code className="text-xs bg-muted/10 px-1 py-0.5 rounded">TENANT</code>, <code className="text-xs bg-muted/10 px-1 py-0.5 rounded">OWNER</code>, or <code className="text-xs bg-muted/10 px-1 py-0.5 rounded">ADMIN</code>).</li>
                <li><strong>Contact Phone Number</strong> (optional, shared only upon explicit tenant inquiry).</li>
              </ul>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground">B. Renter Preferences (Tenants)</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted list-disc list-inside">
                <li><strong>Renter Bio / Introduction</strong> (short self-description shared with owners when requesting a property).</li>
                <li><strong>Preferred City or Locality</strong> (used to recommend matching rental units).</li>
                <li><strong>Monthly Rental Budget</strong> (maximum budget for apartment matching).</li>
                <li><strong>Expected Move-In Timeline</strong> (e.g., Immediately, Within one month, Flexible).</li>
              </ul>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground">C. Property Listing Information (Owners)</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted list-disc list-inside">
                <li>Property title, description, monthly rent, and security deposit amount.</li>
                <li>City, locality, street address, and optional geographical coordinates (latitude/longitude).</li>
                <li>Property type (Apartment, House, Studio, etc.), bedroom/bathroom count, furnishing status, and availability date.</li>
                <li>Uploaded property photos and verification documents (ownership proof submitted for verification).</li>
              </ul>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground">D. User Interactions & Communications</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted list-disc list-inside">
                <li><strong>Rental Requests:</strong> Messages, proposed rent, expected move-in date, and acceptance/rejection timestamps.</li>
                <li><strong>Direct Messages:</strong> In-app chat messages exchanged between prospective tenants and owners, read receipts, and timestamps.</li>
                <li><strong>Notifications:</strong> Records of transactional notifications (e.g. rental request status changes, new chat messages).</li>
                <li><strong>Favorites:</strong> Properties bookmarked by tenants for future viewing.</li>
                <li><strong>Reviews & Moderation Reports:</strong> Ratings, feedback comments, and abuse/fraud reports submitted regarding listings or accounts.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 2. Purpose */}
        <section id="purpose" className="mb-14 scroll-mt-24">
          <h2 className="text-2xl font-bold text-foreground mb-4">2. Purpose of Data Processing</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted space-y-3 leading-relaxed">
            <p>We process your personal information exclusively for legitimate marketplace operations:</p>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Facilitating direct, broker-free connections between residential property owners and tenants.</li>
              <li>Enabling account creation, authentication, password verification, and session management.</li>
              <li>Publishing property listings and rendering search, filter, and discovery results.</li>
              <li>Transmitting rental requests and real-time messaging between matching parties.</li>
              <li>Delivering transactional notifications (such as rental request acceptances or rejections).</li>
              <li>Investigating reports of fraudulent listings, spam, harassment, or abusive conduct.</li>
              <li>Ensuring platform integrity, security, and compliance with applicable Indian digital regulations.</li>
            </ul>
            <p className="pt-2 font-medium text-foreground">
              We do NOT sell, rent, monetize, or trade your personal data to third-party data brokers, advertising networks,
              or external marketing companies.
            </p>
          </div>
        </section>

        {/* 3. Information Visibility */}
        <section id="visibility" className="mb-14 scroll-mt-24">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Eye className="h-6 w-6 text-primary" />
            <span>3. Information Visibility & Sharing</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-card border border-border/70 rounded-xl p-5">
              <h3 className="font-bold text-foreground mb-2">Publicly Visible Information</h3>
              <p className="text-muted leading-relaxed">
                Any visitor to RentGoer can view published property listings (title, photographs, rent, general locality,
                amenities, and owner&apos;s display name). Detailed tenant profiles, private chat conversations, and exact street
                addresses before inquiry are NOT publicly discoverable.
              </p>
            </div>
            <div className="bg-card border border-border/70 rounded-xl p-5">
              <h3 className="font-bold text-foreground mb-2">Shared with Property Owners</h3>
              <p className="text-muted leading-relaxed">
                When a tenant submits a rental request or starts a chat, the property owner receives the tenant&apos;s name,
                renter introduction/bio, preferred city, budget, and move-in timeline so the owner can evaluate compatibility.
              </p>
            </div>
            <div className="bg-card border border-border/70 rounded-xl p-5">
              <h3 className="font-bold text-foreground mb-2">Shared with Prospective Tenants</h3>
              <p className="text-muted leading-relaxed">
                When an owner responds to an inquiry, the tenant can view the owner&apos;s display name, verification status, and
                agreed property rental terms.
              </p>
            </div>
            <div className="bg-card border border-border/70 rounded-xl p-5">
              <h3 className="font-bold text-foreground mb-2">Internal Platform Administrators</h3>
              <p className="text-muted leading-relaxed">
                Designated administrators access account and listing data strictly for moderation, verification requests,
                technical troubleshooting, security enforcement, and resolving reported grievances.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Authentication & Technical Metadata */}
        <section id="auth-sessions" className="mb-14 scroll-mt-24">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Lock className="h-6 w-6 text-primary" />
            <span>4. Authentication & Technical Metadata</span>
          </h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted space-y-4 leading-relaxed">
            <p>
              RentGoer employs modern stateless JSON Web Token (JWT) authentication coupled with database-backed active
              session tracking:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong>HTTP-Only Cookie:</strong> Upon login, an authentication token is issued via an encrypted,{' '}
                <code className="text-xs bg-muted/10 px-1 py-0.5 rounded font-mono">httpOnly</code>,{' '}
                <code className="text-xs bg-muted/10 px-1 py-0.5 rounded font-mono">secure</code>, and{' '}
                <code className="text-xs bg-muted/10 px-1 py-0.5 rounded font-mono">SameSite=Lax</code> cookie named{' '}
                <code className="text-xs bg-muted/10 px-1 py-0.5 rounded font-mono">rentgoer_token</code>. This cookie cannot
                be accessed by client-side JavaScript, protecting against Cross-Site Scripting (XSS) token theft.
              </li>
              <li>
                <strong>Session Record:</strong> When session issuance is enabled, a <code className="text-xs bg-muted/10 px-1 py-0.5 rounded font-mono">Session</code> record
                is stored in the database recording the User Agent header (browser/operating system snippet) and client IP
                address (for brute-force mitigation and account takeover prevention).
              </li>
              <li>
                <strong>No Third-Party Tracking Cookies:</strong> RentGoer does NOT deploy behavioral tracking cookies, canvas
                fingerprinting, or third-party advertising pixels.
              </li>
            </ul>
          </div>
        </section>

        {/* 5. Photos & Object Storage */}
        <section id="media-storage" className="mb-14 scroll-mt-24">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            <span>5. Property Photographs & Object Storage</span>
          </h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>
              Photographs uploaded by property owners are transferred securely over TLS to cloud-hosted object storage
              (Supabase Storage bucket <code className="text-xs bg-muted/10 px-1 py-0.5 rounded font-mono">property-images</code>).
              Image metadata, public URLs, and relational links are tracked in the database to display listings.
            </p>
            <p>
              Owners must only upload photographs of properties they own or are authorized to represent. Do not upload photos
              containing visible personal identification documents, private residential moments, or unrelated individuals.
            </p>
          </div>
        </section>

        {/* 6. Messaging & Notifications */}
        <section id="messaging-notifications" className="mb-14 scroll-mt-24">
          <h2 className="text-2xl font-bold text-foreground mb-4">6. Chat & Real-Time Notifications</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>
              Messages exchanged in RentGoer chat are stored in our database and delivered to the recipient in real time
              via Server-Sent Events (SSE). Both parties can see the message history, timestamps, and read receipts.
            </p>
            <p>
              Chat messages are accessible only to the two participating users (tenant and owner) and authorized platform
              moderators when a message or conversation is formally reported for abuse, harassment, or fraud.
            </p>
          </div>
        </section>

        {/* 7. Cloud Infrastructure */}
        <section id="infrastructure" className="mb-14 scroll-mt-24">
          <h2 className="text-2xl font-bold text-foreground mb-4">7. Cloud Infrastructure & Service Providers</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>RentGoer partners with vetted, enterprise-grade cloud service providers to maintain application reliability:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong>Database & Media Storage:</strong> Supabase PostgreSQL and Storage, hosted in AWS Asia Pacific
                (ap-south-1, Mumbai, India) to maintain domestic data residency standards.
              </li>
              <li>
                <strong>Backend API Hosting:</strong> Render (isolated production container environment with SSL/TLS termination).
              </li>
              <li>
                <strong>Frontend Delivery:</strong> Vercel (Edge-optimized secure Next.js application hosting).
              </li>
            </ul>
          </div>
        </section>

        {/* 8. Data Retention & Account Deletion */}
        <section id="retention-deletion" className="mb-14 scroll-mt-24">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-primary" />
            <span>8. Data Retention & Account Deletion Requests</span>
          </h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <div className="bg-muted/10 border border-border p-4 rounded-lg font-medium text-foreground">
              Transparency Notice on Account Deletion:
            </div>
            <p>
              RentGoer currently <strong>does not feature an automated self-serve deletion button</strong> within the user
              settings screen. Because rental interactions often involve pending rental requests, verification badges, or
              active property listings, account closures are reviewed to ensure no unresolved disputes or fraudulent actions
              are pending.
            </p>
            <p>
              <strong>How to request account closure or data erasure:</strong> You may submit an account closure or data
              deletion request at any time by contacting our support desk via our{' '}
              <Link href="/contact" className="text-primary font-semibold hover:underline">Contact & Grievances page</Link>.
              Upon receiving your request and verifying your identity:
            </p>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Your account session tokens will be permanently revoked.</li>
              <li>Your active property listings will be delisted from the marketplace.</li>
              <li>Your personal profile records will be scheduled for permanent deletion or anonymization, subject to any statutory retention requirements for ongoing fraud investigations or tax compliance.</li>
            </ul>
          </div>
        </section>

        {/* 9. India DPDP Act */}
        <section id="dpdp-rights" className="mb-14 scroll-mt-24">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-primary" />
            <span>9. Your Rights under India&apos;s DPDP Act</span>
          </h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>
              RentGoer operates in recognition of India&apos;s Digital Personal Data Protection (DPDP) Act and its implementing
              framework. As a Data Principal, you have the following rights:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li><strong>Right to Access:</strong> Request a summary of your personal data being processed.</li>
              <li><strong>Right to Correction:</strong> Update or rectify inaccurate or outdated personal details (which you can do directly via your <Link href="/profile" className="text-primary hover:underline">Profile settings</Link>).</li>
              <li><strong>Right to Grievance Redressal:</strong> Direct questions, concerns, or complaints regarding data processing to our designated Grievance Officer.</li>
              <li><strong>Right to Nominate:</strong> Designate a representative to exercise rights on your behalf in the event of incapacity.</li>
            </ul>
            <p className="text-xs text-muted pt-2 italic">
              Note: RentGoer operates in earnest good faith with India&apos;s evolving privacy standards. Publication of this
              policy does not imply independent government certification.
            </p>
          </div>
        </section>

        {/* 10. Policy Updates & Grievances */}
        <section id="policy-updates" className="mb-14 scroll-mt-24">
          <h2 className="text-2xl font-bold text-foreground mb-4">10. Policy Updates & Grievances</h2>
          <div className="bg-card border border-border/70 rounded-xl p-6 text-sm text-muted leading-relaxed space-y-3">
            <p>
              We may update this Privacy Policy periodically to reflect enhancements to our service, new security measures,
              or regulatory developments. Any material changes will be announced on this page with an updated &quot;Last Updated&quot;
              date.
            </p>
            <p>
              For any questions regarding this policy or our data handling practices, please visit our{' '}
              <Link href="/contact" className="text-primary font-semibold hover:underline">Contact & Grievances</Link> page.
            </p>
          </div>
        </section>

        {/* Footer Navigation Back to Legal Pages */}
        <div className="pt-8 border-t border-border/80 flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-4">
            <Link href="/guidelines" className="hover:text-primary transition-colors">Direct Lease Guidelines</Link>
            <span>&bull;</span>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
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
