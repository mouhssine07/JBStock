export type CompanyProfile = {
  name: string; address: string; phone: string; email: string;
  fiscalIdentifiers: { label: string; value: string }[];
};
type DesktopResult<T> = { ok: true; data: T } | { ok: false; code: string };
declare global {
  interface Window {
    jbstock?: {
      getCompany: () => Promise<DesktopResult<CompanyProfile>>;
      saveCompany: (profile: CompanyProfile) => Promise<DesktopResult<CompanyProfile>>;
      getLanguage: () => Promise<DesktopResult<'en' | 'ar'>>;
      setLanguage: (language: 'en' | 'ar') => Promise<DesktopResult<'en' | 'ar'>>;
    };
  }
}

async function request(profile?: CompanyProfile): Promise<CompanyProfile> {
  if (window.jbstock) {
    const result = await (profile ? window.jbstock.saveCompany(profile) : window.jbstock.getCompany());
    if (!result.ok) throw new Error(result.code);
    return result.data;
  }
  const response = await fetch('/api/company', profile ? {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile),
  } : undefined);
  if (!response.ok) throw new Error(response.status === 400 ? 'INVALID_COMPANY' : 'BACKEND_UNAVAILABLE');
  return response.json() as Promise<CompanyProfile>;
}
export const getCompany = () => request();
export const saveCompany = (profile: CompanyProfile) => request(profile);
