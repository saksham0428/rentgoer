import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GuidelinesPage, { metadata as guidelinesMetadata } from '@/app/guidelines/page';
import PrivacyPolicyPage, { metadata as privacyMetadata } from '@/app/privacy/page';
import TermsOfServicePage, { metadata as termsMetadata } from '@/app/terms/page';
import ContactGrievancesPage, { metadata as contactMetadata } from '@/app/contact/page';

describe('Trust & Legal Content Pages', () => {
  describe('Direct Lease Guidelines (/guidelines)', () => {
    it('renders heading, disclosure banner, and 10 tenant due diligence steps', () => {
      const { container } = render(<GuidelinesPage />);

      expect(screen.getByRole('heading', { name: /direct lease guidelines/i, level: 1 })).toBeInTheDocument();
      expect(screen.getByText(/important marketplace role disclosure/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /tenant due diligence guide/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /property owner standards/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /red flags & scam warning signs/i })).toBeInTheDocument();

      // Check tenant steps
      expect(screen.getByRole('heading', { name: /1\. before contacting an owner/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /4\. arranging an in-person property inspection/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /6\. insist on a written rental agreement/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /7\. safe payment practices/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /10\. reporting suspicious listings or abusive users/i })).toBeInTheDocument();

      // Verify no broken placeholder links
      const links = container.querySelectorAll('a');
      expect(links.length).toBeGreaterThan(0);
      links.forEach((a) => {
        expect(a.getAttribute('href')).not.toBe('#');
        expect(a.getAttribute('href')).not.toBe('');
      });
    });

    it('exports proper SEO page metadata', () => {
      expect(guidelinesMetadata.title).toContain('Direct Lease Guidelines');
      expect(guidelinesMetadata.description).toBeTruthy();
    });
  });

  describe('Privacy Policy (/privacy)', () => {
    it('renders all required data collection, storage, and DPDP Act sections', () => {
      const { container } = render(<PrivacyPolicyPage />);

      expect(screen.getByRole('heading', { name: /privacy policy/i, level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /1\. categories of personal data collected/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /3\. information visibility & sharing/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /4\. authentication & technical metadata/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /5\. property photographs & object storage/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /8\. data retention & account deletion requests/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /9\. your rights under india's dpdp act/i })).toBeInTheDocument();

      // Verify accurate technical disclosure of bcrypt, httpOnly cookies, and Supabase storage
      expect(screen.getAllByText(/bcrypt/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/rentgoer_token/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/supabase/i).length).toBeGreaterThan(0);

      // Verify no empty placeholder links
      const links = container.querySelectorAll('a');
      links.forEach((a) => {
        expect(a.getAttribute('href')).not.toBe('#');
      });
    });

    it('exports proper SEO page metadata', () => {
      expect(privacyMetadata.title).toContain('Privacy Policy');
      expect(privacyMetadata.description).toBeTruthy();
    });
  });

  describe('Terms of Service (/terms)', () => {
    it('renders platform scope, tenant/owner obligations, and limitation of liability', () => {
      const { container } = render(<TermsOfServicePage />);

      expect(screen.getByRole('heading', { name: /terms of service/i, level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /marketplace nature & role definition/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /3\. marketplace scope & limitations/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /4\. tenant obligations & conduct/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /5\. property owner obligations & listing rules/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /8\. prohibited activities/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /11\. disclaimers & limitation of liability/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /13\. governing law & dispute jurisdiction/i })).toBeInTheDocument();

      // Verify no empty placeholder links
      const links = container.querySelectorAll('a');
      links.forEach((a) => {
        expect(a.getAttribute('href')).not.toBe('#');
      });
    });

    it('exports proper SEO page metadata', () => {
      expect(termsMetadata.title).toContain('Terms of Service');
      expect(termsMetadata.description).toBeTruthy();
    });
  });

  describe('Contact & Grievances (/contact)', () => {
    it('renders listing report guidance, chat abuse instructions, and escalation timelines', () => {
      const { container } = render(<ContactGrievancesPage />);

      expect(screen.getByRole('heading', { name: /contact & grievances/i, level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /how to report a listing/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /how to report chat abuse/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /account & technical support/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /grievance redressal mechanism/i })).toBeInTheDocument();

      // Check standard grievance turnaround times
      expect(screen.getAllByText(/48 hours/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/7 days/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/30 days/i).length).toBeGreaterThan(0);

      // Verify no empty placeholder links
      const links = container.querySelectorAll('a');
      links.forEach((a) => {
        expect(a.getAttribute('href')).not.toBe('#');
      });
    });

    it('exports proper SEO page metadata', () => {
      expect(contactMetadata.title).toContain('Contact & Grievances');
      expect(contactMetadata.description).toBeTruthy();
    });
  });
});
