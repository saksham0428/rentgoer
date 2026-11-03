import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  Home,
  CheckCircle2,
  DollarSign,
  HelpCircle,
  Flag,
  UserCheck,
  Building,
  KeyRound,
  ArrowRight,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Direct Lease Guidelines | RentGoer',
  description:
    'Comprehensive safety and best-practice guide for tenants and property owners engaging in direct, broker-free residential rentals on RentGoer.',
};

export default function GuidelinesPage() {
  return (
    <div className="bg-background min-h-screen py-10 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Breadcrumb / Tag */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Link href="/" className="hover:underline">Home</Link>
          <span>/</span>
          <span>Trust & Safety</span>
          <span>/</span>
          <span className="text-muted">Guidelines</span>
        </div>

        {/* Hero Title */}
        <div className="border-b border-border/80 pb-8 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-light text-primary text-xs font-semibold mb-4">
            <ShieldCheck className="h-4 w-4" />
            <span>Direct Marketplace Safety Standard</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight">
            Direct Lease Guidelines
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted max-w-3xl leading-relaxed">
            RentGoer connects prospective tenants directly with genuine residential property owners, eliminating
            unnecessary broker commissions. Because lease contracts and rental agreements are executed directly between
            tenants and owners, following structured due-diligence practices is essential for both parties.
          </p>
          <div className="mt-4 text-xs font-medium text-muted">
            Last Updated: November 2026 &bull; Published by RentGoer Trust & Operations
          </div>
        </div>

        {/* Safety Notice Callout */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 sm:p-8 mb-12">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-bold text-foreground">Important Marketplace Role Disclosure</h2>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                RentGoer operates exclusively as a neutral digital marketplace and communications platform. RentGoer{' '}
                <strong>does not hold security deposits, collect or process monthly rent, escrow funds, guarantee property
                ownership titles, or conduct physical property structural inspections</strong>. Tenants and owners must
                personally verify credentials, execute written lease agreements, and manage payments through traceable
                banking channels.
              </p>
            </div>
          </div>
        </div>

        {/* Table of Contents */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 mb-12 shadow-2xs">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span>Contents</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <a href="#tenant-guidelines" className="text-primary hover:underline flex items-center gap-1.5">
              <span className="font-semibold text-xs text-muted">Part I:</span> Tenant Due Diligence (10 Steps)
            </a>
            <a href="#owner-guidelines" className="text-primary hover:underline flex items-center gap-1.5">
              <span className="font-semibold text-xs text-muted">Part II:</span> Property Owner Standards (8 Steps)
            </a>
            <a href="#scam-warnings" className="text-primary hover:underline flex items-center gap-1.5">
              <span className="font-semibold text-xs text-muted">Part III:</span> Red Flags & Scam Prevention
            </a>
            <a href="#reporting" className="text-primary hover:underline flex items-center gap-1.5">
              <span className="font-semibold text-xs text-muted">Part IV:</span> Reporting Suspicious Listings
            </a>
          </div>
        </div>

        {/* PART I: TENANT GUIDELINES */}
        <section id="tenant-guidelines" className="mb-16 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm">
              I
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">Tenant Due Diligence Guide</h2>
              <p className="text-sm text-muted">Follow these 10 structured steps before entering into any rental commitment.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border/70 rounded-xl p-6">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="text-primary font-black">1.</span> Before Contacting an Owner
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Define your firm requirements: maximum monthly budget including maintenance, commute times, furnishing
                needs, and expected move-in timeline. Keep your RentGoer renter profile updated with your preferred city and
                budget so owners can quickly understand your requirements when you reach out.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="text-primary font-black">2.</span> How to Assess a Rental Listing
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Review all listing photographs, stated square footage, furnished status, and amenity tags. Compare the asking
                rent with similar properties in the same locality. Listings with significantly below-market rent or only
                generic exterior photos warrant extra scrutiny.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="text-primary font-black">3.</span> Verifying Property Ownership & Authority to Rent
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Always establish that the person listing the property has legal authority to lease it. Politely request to see
                recent utility bills (electricity or water bill in the owner&apos;s name), municipal property tax receipts, or a
                housing society allotment letter. If dealing with an authorized family member or representative, ask for a
                signed power of attorney.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="text-primary font-black">4.</span> Arranging an In-Person Property Inspection
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                <strong>Never finalize a rental or transfer money without inspecting the physical property in person.</strong>{' '}
                Visit during daylight hours. Test water pressure, electrical outlets, window latches, door locks, plumbing,
                and mobile network reception. Take note of building security, elevator condition, and neighborhood amenities.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="text-primary font-black">5.</span> Key Financial & Operational Questions to Ask
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-muted list-disc list-inside">
                <li>Is building maintenance included in the rent or billed separately?</li>
                <li>What is the exact security deposit amount, and what are the specific deduction rules upon move-out?</li>
                <li>Who pays for regular minor repairs vs. structural/major repairs?</li>
                <li>What is the minimum lock-in period and required notice period (standard is 30 to 60 days)?</li>
                <li>Are there building society restrictions regarding visitors, parking slots, pets, or vehicle charges?</li>
              </ul>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="text-primary font-black">6.</span> Insist on a Written Rental Agreement
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Never rely on verbal understandings. Insist on a written Leave and License or Tenancy Agreement on appropriate
                stamp paper, executed in accordance with local state rent control or tenancy laws. Ensure all agreed amounts,
                deposit terms, inventory lists, and notice periods are documented before signing.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="text-primary font-black">7.</span> Safe Payment Practices
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Never pay security deposits in untraceable cash. Use bank transfers (NEFT, RTGS, IMPS, or UPI) directed
                exclusively to a bank account matching the verified owner&apos;s name. Avoid third-party payment requests or
                unregistered intermediary apps.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="text-primary font-black">8.</span> Payment Receipts & Rent Records
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Obtain a signed, date-stamped receipt or formal written digital acknowledgment for your security deposit and
                every monthly rent payment. Retain bank transfer transaction IDs for tax and rent proof (HRA claims).
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="text-primary font-black">9.</span> Move-In Inspection & Condition Documentation
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                On the day of taking possession, conduct a walkthrough with the owner. Photograph or record video of pre-existing
                scratches, wall marks, appliance conditions, and fixture statuses. Share this inventory record with the owner
                via email or message so both parties share a baseline for future deposit settlement.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span className="text-primary font-black">10.</span> Reporting Suspicious Listings or Abusive Users
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                If an advertiser demands an advance deposit before property inspection, refuses in-person meetings, or sends
                threatening communications, use RentGoer&apos;s in-app <strong>Report Property</strong> button immediately or
                contact the moderation desk via our <Link href="/contact" className="text-primary font-semibold hover:underline">Contact & Grievances</Link> page.
              </p>
            </div>
          </div>
        </section>

        {/* PART II: OWNER GUIDELINES */}
        <section id="owner-guidelines" className="mb-16 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm">
              II
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">Property Owner Standards</h2>
              <p className="text-sm text-muted">Quality, transparency, and fairness standards expected of all RentGoer hosts.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-border/70 rounded-xl p-6">
              <div className="flex items-center gap-2 text-primary font-bold mb-2">
                <Home className="h-4 w-4" />
                <span>1. Accurate Listing Details</span>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                Provide precise details regarding room count, carpet area, furnishings, locality, and landmark. Do not list
                properties that are not currently vacant or available for lease.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <div className="flex items-center gap-2 text-primary font-bold mb-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>2. Authentic Property Photographs</span>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                Upload clear, recent photographs of the actual premises. Never upload stock photography, artist renderings,
                or images from adjacent units without explicit disclosure.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <div className="flex items-center gap-2 text-primary font-bold mb-2">
                <DollarSign className="h-4 w-4" />
                <span>3. Transparent Financial Terms</span>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                State rent, security deposit, and recurring maintenance fees openly. Do not introduce undisclosed fees or
                arbitrary charges after a tenant submits an inquiry.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <div className="flex items-center gap-2 text-primary font-bold mb-2">
                <UserCheck className="h-4 w-4" />
                <span>4. Professional Communication</span>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                Respond respectfully and promptly to tenant inquiries and inspection requests via RentGoer chat. Maintain
                professional language at all times.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <div className="flex items-center gap-2 text-primary font-bold mb-2">
                <FileText className="h-4 w-4" />
                <span>5. Fair Request Evaluation</span>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                Evaluate prospective tenants on legitimate rental criteria (budget compatibility, move-in timeline, lease
                terms) without unlawful discrimination based on religion, gender, ethnicity, or marital status.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <div className="flex items-center gap-2 text-primary font-bold mb-2">
                <KeyRound className="h-4 w-4" />
                <span>6. Respect for Tenant Privacy</span>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                Safeguard tenant contact numbers and personal information. Once leased, respect the tenant&apos;s quiet enjoyment
                of the property and provide reasonable prior notice before property visits.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <div className="flex items-center gap-2 text-primary font-bold mb-2">
                <Building className="h-4 w-4" />
                <span>7. Clear Written Agreements</span>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                Provide a standard, fair written lease agreement detailing repair responsibilities, utility payments, and
                prompt deposit refund timelines upon lease conclusion.
              </p>
            </div>

            <div className="bg-card border border-border/70 rounded-xl p-6">
              <div className="flex items-center gap-2 text-primary font-bold mb-2">
                <ShieldCheck className="h-4 w-4" />
                <span>8. Platform Integrity</span>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                Never solicit or charge prospective tenants for showing properties or granting viewing passes. RentGoer is
                strictly zero-brokerage for renters.
              </p>
            </div>
          </div>
        </section>

        {/* PART III: SCAM WARNING SIGNS */}
        <section id="scam-warnings" className="mb-16 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-xl bg-danger/10 text-danger flex items-center justify-center font-bold text-sm">
              III
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">Red Flags & Scam Warning Signs</h2>
              <p className="text-sm text-muted">Protect yourself against common rental frauds observed in online real estate.</p>
            </div>
          </div>

          <div className="bg-card border border-danger/20 rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-foreground">Demand for Advance Token or &quot;Gate Pass&quot; Fees</h3>
                <p className="text-sm text-muted mt-1 leading-relaxed">
                  A fraudster claims the housing society requires a &quot;visitor pass fee&quot;, &quot;refundable security code&quot;, or &quot;viewing
                  slot deposit&quot; via UPI before you can enter the building. <strong>Legitimate owners never charge fees to show properties.</strong>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-3 border-t border-border/60">
              <AlertTriangle className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-foreground">Absent Owner Claiming Army / Government / Overseas Posting</h3>
                <p className="text-sm text-muted mt-1 leading-relaxed">
                  Scammers often claim to be an army officer, doctor, or diplomat posted in another city who cannot show the
                  flat but promises to courier keys once you transfer an advance deposit. Never transfer funds under this premise.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-3 border-t border-border/60">
              <AlertTriangle className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-foreground">Unbelievable Bargain Pricing in Prime Localities</h3>
                <p className="text-sm text-muted mt-1 leading-relaxed">
                  A luxury 3BHK in an upscale area listed at 40% below market rate is almost always a lure designed to rush
                  prospective renters into paying quick booking advances.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-3 border-t border-border/60">
              <AlertTriangle className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-foreground">Pressure to Pay Immediately Without Documents</h3>
                <p className="text-sm text-muted mt-1 leading-relaxed">
                  Urgent claims like &quot;five other tenants are transferring the token right now&quot; are intended to bypass your
                  normal verification instinct. Take your time to inspect the property and verify papers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PART IV: REPORTING & GRIEVANCES */}
        <section id="reporting" className="mb-16 scroll-mt-24">
          <div className="bg-primary-light/60 border border-primary/20 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2">
                <Flag className="h-4 w-4" />
                <span>Found a Suspicious Listing or User?</span>
              </div>
              <h2 className="text-xl font-extrabold text-foreground">Help Us Keep RentGoer 100% Direct & Safe</h2>
              <p className="text-sm text-muted mt-1.5 max-w-xl leading-relaxed">
                Use the in-app reporting tools on any property card or chat thread. Our moderation team reviews flagged listings
                promptly and suspends fraudulent accounts.
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-primary-hover transition-colors flex-shrink-0"
            >
              <span>Contact & Grievances</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Footer Navigation Back to Legal Pages */}
        <div className="pt-8 border-t border-border/80 flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <span>&bull;</span>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            <span>&bull;</span>
            <Link href="/contact" className="hover:text-primary transition-colors">Contact & Grievances</Link>
          </div>
          <div>
            <Link href="/properties" className="text-primary font-semibold hover:underline">
              Browse Verified Properties &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
