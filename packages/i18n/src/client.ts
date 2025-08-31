"use client";

import { useTranslation as useTranslationOrg } from "react-i18next";

import { defaultNamespace } from "./config";
import type { Namespace } from "./config";

// Re-export React components that can only be used on client-side
export { I18nextProvider, Trans, Translation, withTranslation } from "react-i18next";

/**
 * Client-side translation hook for React components.
 *
 * This hook does not initialize i18next on the client; instead, it relies on the server-side initialization
 * passed down via TranslationsProvider. It simply wraps the basic react-i18next hook.
 *
 * @param ns - The translation namespace(s) to use. Defaults to the `defaultNamespace`, which is usually 'common'.
 * @param options - Optional options, e.g., { keyPrefix }.
 *
 * @remarks
 * - The default namespace is 'common'. If you do not specify a namespace, translations will be looked up in 'common'.
 * - Language selection is handled by Next.js routing and server-side setup.
 *
 * @example
 * // Uses the default 'common' namespace
 * const { t } = useTranslation();
 *
 * // Uses a specific namespace
 * const { t } = useTranslation('dashboard');
 */
export function useTranslation(
  ns: Namespace | Namespace[] = defaultNamespace,
  options: { keyPrefix?: string } = {},
) {
  // Just use the basic react-i18next hook without any custom language changing logic
  // The language should be handled by Next.js routing and server-side setup
  return useTranslationOrg(ns, options);
}
