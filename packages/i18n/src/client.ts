"use client";

import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import resourcesToBackend from "i18next-resources-to-backend";
import {
  initReactI18next,
  useTranslation as useTranslationOrg,
} from "react-i18next";

import {
  defaultNamespace,
  fallbackLng,
  fallbackNS,
  i18nConfig,
  type Locale,
  type Namespace,
} from "./config";

// Initialize i18next for client-side usage
const runsOnServerSide = typeof window === "undefined";

i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(
    resourcesToBackend(
      (language: string, namespace: string) =>
        import(`../locales/${language}/${namespace}.json`),
    ),
  )
  .init({
    lng: undefined, // Let LanguageDetector handle this
    fallbackLng,
    supportedLngs: i18nConfig.locales,
    defaultNS: defaultNamespace,
    fallbackNS,
    debug: false,
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    react: {
      useSuspense: runsOnServerSide,
    },
  });

export function useTranslation(
  lng?: Locale,
  ns: Namespace | Namespace[] = defaultNamespace,
  options: { keyPrefix?: string } = {},
) {
  const ret = useTranslationOrg(ns, options);
  
  // For client-side, let react-i18next handle language changes through URL routing
  // We don't need to manually change language here as it's handled by Next.js routing
  
  return ret;
}
