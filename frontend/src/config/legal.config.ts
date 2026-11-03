/**
 * Centralized, typed configuration for official RentGoer business, support,
 * and grievance redressal details.
 *
 * IMPORTANT: To preserve user trust and comply with regulatory standards,
 * never inject fabricated company names, addresses, or grievance officer
 * details. If an official value is not configured via environment variables,
 * it remains explicitly undefined, and user-facing views render an official
 * transparency notice rather than fake placeholders.
 */

export interface GrievanceOfficerInfo {
  name?: string;
  designation?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface BusinessConfig {
  platformName: string;
  legalEntityName?: string;
  registeredOfficeAddress?: string;
  supportEmail?: string;
  supportPhone?: string;
  supportHours?: string;
  turnaroundTimeHours: number;
  resolutionTimeDays: number;
  grievanceOfficer: GrievanceOfficerInfo;
  isRegisteredEntityConfigured: boolean;
  isGrievanceOfficerConfigured: boolean;
}

const rawEntityName = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim();
const rawAddress = process.env.NEXT_PUBLIC_REGISTERED_OFFICE_ADDRESS?.trim();
const rawSupportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
const rawSupportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim();
const rawGrievanceName = process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME?.trim();
const rawGrievanceDesignation = process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_DESIGNATION?.trim();
const rawGrievanceEmail = process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_EMAIL?.trim();

export const legalConfig: BusinessConfig = {
  platformName: 'RentGoer',
  legalEntityName: rawEntityName || undefined,
  registeredOfficeAddress: rawAddress || undefined,
  supportEmail: rawSupportEmail || undefined,
  supportPhone: rawSupportPhone || undefined,
  supportHours: 'Monday – Friday, 9:30 AM – 6:30 PM IST',
  turnaroundTimeHours: 48,
  resolutionTimeDays: 30,
  grievanceOfficer: {
    name: rawGrievanceName || undefined,
    designation: rawGrievanceDesignation || undefined,
    email: rawGrievanceEmail || rawSupportEmail || undefined,
    phone: rawSupportPhone || undefined,
    address: rawAddress || undefined,
  },
  isRegisteredEntityConfigured: Boolean(rawEntityName && rawAddress),
  isGrievanceOfficerConfigured: Boolean(rawGrievanceName && (rawGrievanceEmail || rawSupportEmail)),
};
