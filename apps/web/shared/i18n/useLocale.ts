"use client";

import { useTranslation } from "@repo/i18n";

/**
 * Custom hook that provides the current locale from the i18n context.
 * This is a convenience hook that extracts the locale from useTranslation
 * without needing to destructure both t and i18n everywhere.
 *
 * @returns The current locale (e.g., "en-US", "de-DE", "nl-NL")
 */
export function useLocale() {
  const { i18n } = useTranslation();
  return i18n.language;
}
