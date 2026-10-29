import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import enApp from './en.app';
import hi from './hi';
import hiApp from './hi.app';
import ta from './ta';
import taApp from './ta.app';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'hi', label: 'हिन्दी' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const STORAGE_KEY = 'secondsun.language';

function storedLanguage(): LanguageCode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value && LANGUAGES.some((l) => l.code === value)) return value as LanguageCode;
  } catch {
    // Storage can be unavailable (private mode); fall back to English.
  }
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    // Missing Tamil or Hindi keys fall back to English (see TODO native review in the catalogs).
    en: { translation: { ...en, ...enApp } },
    ta: { translation: { ...ta, ...taApp } },
    hi: { translation: { ...hi, ...hiApp } },
  },
  lng: storedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // Ignore: the choice just won't persist across reloads.
  }
});

export default i18n;
