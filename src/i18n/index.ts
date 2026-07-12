import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { createMMKV } from 'react-native-mmkv';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';

export const SUPPORTED_LANGUAGES = ['en', 'de', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_STORAGE_KEY = 'app.language';
const storage = createMMKV({ id: 'app-settings' });

function resolveLanguage(code: string | undefined | null): SupportedLanguage {
  if (code === 'de' || code === 'es' || code === 'en') {
    return code;
  }

  return 'en';
}

function getDeviceLanguage(): SupportedLanguage {
  const languageCode = Localization.getLocales()[0]?.languageCode;
  return resolveLanguage(languageCode);
}

function getInitialLanguage(): SupportedLanguage {
  const savedLanguage = storage.getString(LANGUAGE_STORAGE_KEY);

  if (savedLanguage) {
    return resolveLanguage(savedLanguage);
  }

  const deviceLanguage = getDeviceLanguage();
  storage.set(LANGUAGE_STORAGE_KEY, deviceLanguage);
  return deviceLanguage;
}

export function getAppLanguage(): SupportedLanguage {
  return resolveLanguage(i18n.language);
}

export function setAppLanguage(language: SupportedLanguage) {
  storage.set(LANGUAGE_STORAGE_KEY, language);
  void i18n.changeLanguage(language);
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
    es: { translation: es },
  },
  lng: getInitialLanguage(),
  fallbackLng: ['en'],
  supportedLngs: SUPPORTED_LANGUAGES,
  nonExplicitSupportedLngs: true,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
