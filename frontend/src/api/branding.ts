import { apiRequest } from './client';

export interface BrandingConfig {
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  fontFamily: string;
}

export interface CompanyInfo {
  name: string;
  slug: string;
  branding: BrandingConfig | null;
}

/** Fetch company info and branding for a public booking page. */
export async function getCompanyBranding(companySlug: string): Promise<CompanyInfo> {
  return apiRequest(`/booking/${companySlug}/info`);
}
