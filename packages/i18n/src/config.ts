// Supported locales configuration
export const defaultLocale = "en-US" as const;
export const locales = [
  defaultLocale,
  "de-DE",
  // "nl-NL"
] as const;

export type Locale = (typeof locales)[number];

// i18n routing configuration for Next.js
export const i18nConfig = {
  locales,
  defaultLocale,
  // Use this for URL-based locale detection
  localeDetection: true,
} as const;

// Namespace configuration
export const defaultNamespace = "common" as const;
export const namespaces = [
  "common",
  "navigation",
  "experiments",
  "dashboard",
  "account",
  "macro",
  "experimentData",
  "experimentVisualizations",
] as const;

export type Namespace = (typeof namespaces)[number];

// Fallback configuration
export const fallbackLng = defaultLocale;
export const fallbackNS = defaultNamespace;

export default i18nConfig;
