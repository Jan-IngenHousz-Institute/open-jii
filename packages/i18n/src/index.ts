// Re-export configuration and types
export * from "./config";

// Re-export server-side functionality
export { default as initTranslations } from "./server";
export type { InitTranslationsProps } from "./server";

// Re-export client-side functionality
export { useTranslation } from "./client";

// Re-export i18next core functions (safe for server-side)
export {
  default as i18next,
  createInstance,
  dir,
  getFixedT,
  init,
  loadLanguages,
  loadNamespaces,
  loadResources,
  reloadResources,
  setDefaultNamespace,
  t,
  use,
  changeLanguage,
} from "i18next";

// Re-export resources to backend
export { default as resourcesToBackend } from "i18next-resources-to-backend";

// Utility types for better TypeScript support
export type TranslationKeys<T = Record<string, unknown>> = {
  [K in keyof T]: K extends string ? K : never;
}[keyof T];

// Helper function to create type-safe translation keys
export function createTranslationKey<T extends string>(key: T): T {
  return key;
}

// Middleware helper for Next.js
export { i18nRouter } from "next-i18n-router";
export { useCurrentLocale } from "next-i18n-router/client";
// Export commonly used types from i18next
export type {
  TFunction,
  i18n,
  InitOptions,
  Resource,
  ResourceLanguage,
  TOptions,
  KeyPrefix,
} from "i18next";

// Export types from react-i18next (types are safe)
export type {
  UseTranslationOptions,
  UseTranslationResponse,
  WithTranslation,
  WithTranslationProps,
  TransProps,
} from "react-i18next";
