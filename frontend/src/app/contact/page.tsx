import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import {
  LifeBuoy,
  Flag,
  MessageSquare,
  ShieldAlert,
  Clock,
  Mail,
  Building,
  CheckCircle2,
  FileQuestion,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { legalConfig } from '@/config/legal.config';

export const metadata: Metadata = {
  title: 'Contact & Grievances | RentGoer',
  description:
    'Official support, abuse reporting, grievance redressal, and dispute escalation channels for RentGoer users.',
};

export default function ContactGrievancesPage() {
  const isCorporateConfigured = legalConfig.isRegisteredEntityConfigured;
  const isGrievanceOfficerConfigured = legalConfig.isGrievanceOfficerConfigured;

  return (
    <div className="bg-background min-h-screen py-10 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Link href="/" className="hover:underline">Home</Link>
          <span>/</span>
          <span>Trust & Safety</span>
          <span>/</span>
          <span className="text-muted">Contact & Grievances</span>
        </div>

        {/* Hero Title */}
        <div className="border-b border-border/80 pb-8 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-light text-primary text-xs font-semibold mb-4">
            <LifeBuoy className="h-4 w-4" />
            <span>Community Support & Redressal Desk</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight">
            Contact & Grievances
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted max-w-3xl leading-relaxed">
            RentGoer is committed to providing a safe, transparent, and direct residential rental marketplace.
            Whether you need assistance with an active account, wish to report a fraudulent listing, or have a formal
            grievance, follow the dedicated channels below.
          </p>
          <div className="mt-4 text-xs font-medium text-muted">
            Last Updated: November 2026 &bull; Direct Escalation Redressal Process
          </div>
        </div>

        {/* Official Business Notice (Transparent disclosure when env details are pending) */}
        {!isCorporateConfigured && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 sm:p-7 mb-12">
            <div className="flex items-start gap-4">
              <Building className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-base font-bold text-foreground">Corporate Registration Notice</h2>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  RentGoer is an independent direct rental platform currently finalizing formal corporate registration and
                  statutory grievance officer filings in India. To preserve full transparency, we do not publish placeholder
                  corporate addresses or synthetic names. You can reach our operational administration and moderation desks
                  via the dedicated digital channels detailed on this page.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <a
            href="#report-listing"
            className="bg-card border border-border/80 hover:border-primary/40 rounded-2xl p-6 transition-all hover:shadow-xs group"
          >
            <div className="h-10 w-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Flag className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">
              Report a Listing
            </h3>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Flag fraudulent prices, fake photos, advance fee demands, or non-existent properties.
            </p>
          </a>

          <a
            href="#report-chat"
            className="bg-card border border-border/80 hover:border-primary/40 rounded-2xl p-6 transition-all hover:shadow-xs group"
          >
            <div className="h-10 w-10 rounded-xl bg-primary-light text-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">
              Report Chat Abuse
            </h3>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Report harassment, inappropriate language, external payment links, or spam in direct messages.
            </p>
          </a>

          <a
            href="#grievance-officer"
            className="bg-card border border-border/80 hover:border-primary/40 rounded-2xl p-6 transition-all hover:shadow-xs group"
          >
            <div className="h-10 w-10 rounded-xl bg-accent-gold/10 text-accent-gold flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">
              Grievance Escalation
            </h3>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Formal complaints under the Information Technology Act and DPDP Act framework.
            </p>
          </a>
        </div>

        {/* 1. Report Fraudulent Listing */}
        <section id="report-listing" className="mb-14 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-xl bg-danger/10 text-danger flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">How to Report a Listing</h2>
              <p className="text-sm text-muted">Immediate action path for fake listings, scam requests, or copyright violations.</p>
            </div>
          </div>

          <div className="bg-card border border-border/70 rounded-2xl p-6 sm:p-8 space-y-4 text-sm text-muted leading-relaxed">
            <p>
              If you come across a property listing on RentGoer that involves any of the following, report it immediately:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Demanding advance payments, &quot;gate pass&quot; fees, or deposit tokens before an in-person physical inspection.</li>
              <li>Fake or copied photos taken from another real estate site or social media without authorization.</li>
              <li>Drastically false rental pricing intended as clickbait.</li>
              <li>A host who is not the actual owner and lacks legal authorization to lease the premises.</li>
            </ul>

            <div className="bg-muted/10 border border-border/80 rounded-xl p-5 mt-4 space-y-2">
              <div className="font-bold text-foreground">Step-by-Step Reporting Instructions:</div>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted">
                <li>Navigate to the property&apos;s details page on RentGoer.</li>
                <li>Scroll to the bottom of the property details or action panel and click the <strong>&quot;Report Property&quot;</strong> button.</li>
                <li>Select the applicable reason (e.g., <em>Fraud/Scam, Fake Listing, Inappropriate Content, Misleading Information</em>).</li>
                <li>Provide a concise explanation and include any relevant details (such as external payment demands).</li>
                <li>Click <strong>&quot;Submit Report&quot;</strong>. Our moderation queue automatically prioritizes scam reports.</li>
              </ol>
            </div>
          </div>
        </section>

        {/* 2. Report Chat Abuse */}
        <section id="report-chat" className="mb-14 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">How to Report Chat Abuse</h2>
              <p className="text-sm text-muted">Maintaining safe, respectful communication on RentGoer.</p>
            </div>
          </div>

          <div className="bg-card border border-border/70 rounded-2xl p-6 sm:p-8 space-y-4 text-sm text-muted leading-relaxed">
            <p>
              RentGoer maintains a strict zero-tolerance policy against abusive, threatening, obscene, or fraudulent chat
              communications.
            </p>
            <div className="bg-muted/10 border border-border/80 rounded-xl p-5 space-y-2">
              <div className="font-bold text-foreground">Reporting In-App Chat Messages:</div>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted">
                <li>Within the active chat thread, locate the message in question.</li>
                <li>Click the <strong>Report</strong> flag icon next to the message.</li>
                <li>Choose the category (e.g., <em>Harassment, Spam, Fraud</em>) and submit.</li>
                <li>The reported message and conversation context are instantly flagged for moderator review.</li>
              </ol>
            </div>
            <p>
              You may also block further messages by ceasing the conversation or contacting our support desk.
            </p>
          </div>
        </section>

        {/* 3. Account Support */}
        <section id="account-support" className="mb-14 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm">
              3
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">Account & Technical Support</h2>
              <p className="text-sm text-muted">Help with account access, profile updates, and listing management.</p>
            </div>
          </div>

          <div className="bg-card border border-border/70 rounded-2xl p-6 sm:p-8 space-y-4 text-sm text-muted leading-relaxed">
            <p>
              For technical queries regarding your active RentGoer account:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="border border-border/80 rounded-xl p-5">
                <h3 className="font-bold text-foreground mb-1">For Tenants</h3>
                <ul className="text-xs space-y-1.5 list-disc list-inside mt-2">
                  <li>Profile preference updates (<Link href="/profile" className="text-primary hover:underline">Edit Profile</Link>)</li>
                  <li>Tracking rental request status (<Link href="/rental-requests" className="text-primary hover:underline">Requests</Link>)</li>
                  <li>Managing saved properties (<Link href="/favorites" className="text-primary hover:underline">Favorites</Link>)</li>
                  <li>Inquiring about owner responses</li>
                </ul>
              </div>

              <div className="border border-border/80 rounded-xl p-5">
                <h3 className="font-bold text-foreground mb-1">For Property Owners</h3>
                <ul className="text-xs space-y-1.5 list-disc list-inside mt-2">
                  <li>Listing updates and photographs (<Link href="/owner" className="text-primary hover:underline">Owner Dashboard</Link>)</li>
                  <li>Property verification badge requests</li>
                  <li>Evaluating incoming rental applications (<Link href="/owner/requests" className="text-primary hover:underline">Owner Requests</Link>)</li>
                  <li>Marking properties as occupied / unavailable</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Grievance Redressal Mechanism */}
        <section id="grievance-officer" className="mb-14 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-xl bg-accent-gold/20 text-accent-gold flex items-center justify-center font-bold text-sm">
              4
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">Grievance Redressal Mechanism</h2>
              <p className="text-sm text-muted">Statutory escalation under the Information Technology Act & DPDP Act.</p>
            </div>
          </div>

          <div className="bg-card border border-border/70 rounded-2xl p-6 sm:p-8 space-y-6 text-sm text-muted leading-relaxed">
            <div>
              <h3 className="font-bold text-foreground text-base mb-2">Escalation Process & Timelines</h3>
              <p>
                RentGoer adheres to standard procedural timelines for consumer grievances and data principal inquiries:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div className="bg-muted/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-primary">48 Hours</div>
                  <div className="text-xs font-semibold text-foreground mt-1">Acknowledgment</div>
                  <div className="text-xs text-muted mt-1">Receipt confirmation and ticket number issued.</div>
                </div>

                <div className="bg-muted/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-primary">7 Days</div>
                  <div className="text-xs font-semibold text-foreground mt-1">Preliminary Review</div>
                  <div className="text-xs text-muted mt-1">Investigation and initial response provided.</div>
                </div>

                <div className="bg-muted/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-primary">30 Days</div>
                  <div className="text-xs font-semibold text-foreground mt-1">Final Resolution</div>
                  <div className="text-xs text-muted mt-1">Formal determination and resolution closure.</div>
                </div>
              </div>
            </div>

            <div className="border-t border-border/80 pt-6">
              <h3 className="font-bold text-foreground text-base mb-3">Grievance Officer Particulars</h3>
              {isGrievanceOfficerConfigured ? (
                <div className="bg-muted/10 rounded-xl p-5 space-y-2">
                  <div><strong>Name:</strong> {legalConfig.grievanceOfficer.name}</div>
                  <div><strong>Designation:</strong> {legalConfig.grievanceOfficer.designation}</div>
                  <div><strong>Email:</strong> {legalConfig.grievanceOfficer.email}</div>
                  {legalConfig.grievanceOfficer.address && (
                    <div><strong>Address:</strong> {legalConfig.grievanceOfficer.address}</div>
                  )}
                </div>
              ) : (
                <div className="bg-muted/10 rounded-xl p-5 space-y-2">
                  <div className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Statutory Grievance Desk
                  </div>
                  <p className="text-sm text-muted">
                    Formal officer appointment details are currently being updated in registry filings. Users wishing to
                    submit an escalated dispute, copyright notice, or formal data privacy grievance may submit a detailed
                    notice via our verified operational escalation inbox:
                  </p>
                  <div className="pt-2">
                    <span className="font-mono text-xs bg-card px-2.5 py-1.5 rounded border border-border select-all font-semibold text-foreground">
                      {legalConfig.supportEmail || 'support@rentgoer.com'}
                    </span>
                  </div>
                  <p className="text-xs text-muted pt-1">
                    Please include your registered account email, relevant property or user IDs, and supporting evidence.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Footer Navigation Back to Legal Pages */}
        <div className="pt-8 border-t border-border/80 flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-4">
            <Link href="/guidelines" className="hover:text-primary transition-colors">Direct Lease Guidelines</Link>
            <span>&bull;</span>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <span>&bull;</span>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
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
