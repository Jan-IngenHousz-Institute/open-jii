// Re-export configuration and types
export * from "./config";

// Re-export server-side functionality
export { default as initTranslations } from "./server";
export type { InitTranslationsProps } from "./server";

// Re-export client-side functionality
export { useTranslation } from "./client";

// Re-export react-i18next hooks and components
export {
  useTranslation as useReactI18next,
  I18nextProvider,
  initReactI18next,
  Trans,
  Translation,
  withTranslation,
  withSSR,
  useSSR,
} from "react-i18next";

// Re-export i18next core - only the main functions
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

// Re-export browser language detector
export { default as LanguageDetector } from "i18next-browser-languagedetector";

// Re-export HTTP backend
export { default as HttpBackend } from "i18next-http-backend";

// Re-export resources to backend
export { default as resourcesToBackend } from "i18next-resources-to-backend";

// Utility types for better TypeScript support
export type TranslationKeys<T = Record<string, any>> = {
  [K in keyof T]: K extends string ? K : never;
}[keyof T];

// Helper function to create type-safe translation keys
export function createTranslationKey<T extends string>(key: T): T {
  return key;
}

// Middleware helper for Next.js
export { i18nRouter } from "next-i18n-router";

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

// Export types from react-i18next
export type {
  UseTranslationOptions,
  UseTranslationResponse,
  WithTranslation,
  WithTranslationProps,
  TransProps,
} from "react-i18next";
