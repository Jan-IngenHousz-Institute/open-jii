"use client";

import { useTranslation as useTranslationOrg } from "react-i18next";

import { defaultNamespace, type Locale, type Namespace } from "./config";

// Re-export React components that can only be used on client-side
export { I18nextProvider, Trans, Translation, withTranslation } from "react-i18next";

// Simple client-side hook that doesn't initialize i18next
// Instead, it relies on the server-side initialization passed down via TranslationsProvider
export function useTranslation(
  lng?: Locale,
  ns: Namespace | Namespace[] = defaultNamespace,
  options: { keyPrefix?: string } = {},
) {
  // Just use the basic react-i18next hook without any custom language changing logic
  // The language should be handled by Next.js routing and server-side setup
  return useTranslationOrg(ns, options);
}
