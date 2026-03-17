import { apiRequest } from './client';

export interface BrandingConfig {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  logoUrl: string | null;
  fontFamily: string;
  showPoweredBy: boolean;
  footerText: string | null;
}

export interface CompanyInfo {
  name: string;
  slug: string;
  branding: BrandingConfig | null;
}

export interface BookingInfo {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  eventType: { title: string; duration: number };
  assignedUser: { name: string; email: string };
  customer: { name: string; email: string } | null;
  company: { name: string; slug: string } | null;
  branding: BrandingConfig | null;
}

/** Fetch company info and branding for a public booking page. */
export async function getCompanyBranding(companySlug: string): Promise<CompanyInfo> {
  return apiRequest(`/booking/${companySlug}/info`);
}

/** Fetch booking details + branding via booking token. */
export async function getBookingByToken(bookingToken: string): Promise<BookingInfo> {
  return apiRequest(`/booking/${bookingToken}`);
}
