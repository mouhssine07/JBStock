import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getCompany, saveCompany } from "./services/company";
import type { CompanyProfile } from "./services/company";
import { useLanguage } from './i18n';
import type { Language, MessageKey } from './i18n';

type FiscalIdentifier = { label: string; value: string };

const emptyProfile: CompanyProfile = { name: "", address: "", phone: "", email: "", fiscalIdentifiers: [] };

function App() {
  const { language, setLanguage, t, formatNumber, changing, storageError } = useLanguage();
  const [profile, setProfile] = useState<CompanyProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    getCompany()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {
        if (active) setError('loadError');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || saving) return;
    setSaved(false);
    if (!profile.name.trim()) { setError('nameRequired'); return; }
    if (profile.fiscalIdentifiers.some(identifier => !identifier.label.trim())) {
      setError('identifierRequired'); return;
    }
    const email = event.currentTarget.elements.namedItem('email') as HTMLInputElement;
    if (email.validity.typeMismatch) { setError('emailInvalid'); email.focus(); return; }
    if (profile.name.length > 255 || profile.address.length > 2000 || profile.phone.length > 50
      || profile.email.length > 254 || profile.fiscalIdentifiers.length > 20
      || profile.fiscalIdentifiers.some(identifier => identifier.label.length > 100 || identifier.value.length > 255)) {
      setError('invalidCompany'); return;
    }
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      setProfile(await saveCompany(profile));
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error && reason.message === 'INVALID_COMPANY' ? 'invalidCompany' : 'saveError');
    } finally {
      setSaving(false);
    }
  }

  function update(field: keyof CompanyProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  function updateIdentifier(index: number, field: keyof FiscalIdentifier, value: string) {
    setProfile((current) => ({
      ...current,
      fiscalIdentifiers: current.fiscalIdentifiers.map((identifier, itemIndex) =>
        itemIndex === index ? { ...identifier, [field]: value } : identifier),
    }));
    setSaved(false);
  }

  function addIdentifier() {
    if (profile.fiscalIdentifiers.length >= 20) return;
    setProfile((current) => ({
      ...current,
      fiscalIdentifiers: [...current.fiscalIdentifiers, { label: "", value: "" }],
    }));
    setSaved(false);
  }

  function removeIdentifier(index: number) {
    setProfile((current) => ({
      ...current,
      fiscalIdentifiers: current.fiscalIdentifiers.filter((_, itemIndex) => itemIndex !== index),
    }));
    setSaved(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-semibold tracking-wide text-indigo-700">{t('appName')}</p>
            <label className="flex items-center gap-3 text-sm">
              <span>{t('language')}</span>
              <select name="language" value={language} disabled={changing}
                onChange={event => { void setLanguage(event.target.value as Language); }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="en" lang="en">{t('english')}</option>
                <option value="ar" lang="ar">{t('arabic')}</option>
              </select>
            </label>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('companyTitle')}</h1>
          <p className="mt-2 text-slate-600">{t('companyIntro')}</p>
          {storageError && <p role="alert" className="mt-3 text-sm text-rose-700">{t('languageStorageError')}</p>}
        </header>

        <form noValidate onSubmit={saveProfile} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-medium">{t('name')} <span className="text-rose-600">*</span></span>
              <input name="name" dir="auto" required maxLength={255} value={profile.name} onChange={(event) => update("name", event.target.value)}
                disabled={loading || saving} autoComplete="organization"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100" />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-medium">{t('address')}</span>
              <textarea name="address" dir="auto" maxLength={2000} rows={3} value={profile.address} onChange={(event) => update("address", event.target.value)}
                disabled={loading || saving} autoComplete="street-address"
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium">{t('phone')}</span>
              <input name="phone" dir="ltr" type="tel" maxLength={50} value={profile.phone} onChange={(event) => update("phone", event.target.value)}
                disabled={loading || saving} autoComplete="tel"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100" />
            </label>
            <section className="sm:col-span-2" aria-labelledby="fiscal-identifiers-heading">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 id="fiscal-identifiers-heading" className="text-sm font-medium">{t('fiscalTitle')}</h2>
                  <p className="mt-1 text-xs text-slate-500">{t('fiscalHelp')}</p>
                </div>
                <button type="button" onClick={addIdentifier}
                  disabled={loading || saving || profile.fiscalIdentifiers.length >= 20}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
                  {t('addIdentifier')}
                </button>
              </div>
              {profile.fiscalIdentifiers.map((identifier, index) => (
                <div key={index} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <label>
                    <span className="sr-only">{t('identifierLabel')}</span>
                    <input dir="auto" required maxLength={100} placeholder={t('identifierPlaceholder')}
                      value={identifier.label} onChange={(event) => updateIdentifier(index, "label", event.target.value)}
                      disabled={loading || saving}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100" />
                  </label>
                  <label>
                    <span className="sr-only">{t('identifierValue')}</span>
                    <input dir="auto" maxLength={255} placeholder={t('identifierValue')}
                      value={identifier.value} onChange={(event) => updateIdentifier(index, "value", event.target.value)}
                      disabled={loading || saving}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100" />
                  </label>
                  <button type="button" onClick={() => removeIdentifier(index)} disabled={loading || saving}
                    aria-label={t('removeIdentifier', { number: formatNumber(index + 1) })}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                    {t('remove')}
                  </button>
                </div>
              ))}
            </section>
            <label>
              <span className="mb-2 block text-sm font-medium">{t('email')}</span>
              <input name="email" dir="ltr" type="email" maxLength={254} value={profile.email} onChange={(event) => update("email", event.target.value)}
                disabled={loading || saving} autoComplete="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100" />
            </label>
          </div>

          {error && <p className="mt-5 text-sm text-rose-700" role="alert">{t(error)}</p>}
          {saved && <p className="mt-5 text-sm text-emerald-700" role="status">{t('saved')}</p>}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
            <p className="text-xs text-slate-500">{t('localStorage')}</p>
            <button type="submit" disabled={loading || saving}
              className="rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50">
              {t(loading ? 'loading' : saving ? 'saving' : 'save')}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default App;
