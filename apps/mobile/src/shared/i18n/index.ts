import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18next from "i18next";
import { useEffect, useState } from "react";
import { initReactI18next } from "react-i18next";

import authEn from "./locales/en-US/auth.json";
import calibrationEn from "./locales/en-US/calibration.json";
import commonEn from "./locales/en-US/common.json";
import connectionEn from "./locales/en-US/connection.json";
import experimentsEn from "./locales/en-US/experiments.json";
import homeEn from "./locales/en-US/home.json";
import measurementFlowEn from "./locales/en-US/measurement-flow.json";
import profileEn from "./locales/en-US/profile.json";
import recentMeasurementsEn from "./locales/en-US/recent-measurements.json";
import authNl from "./locales/nl-NL/auth.json";
import calibrationNl from "./locales/nl-NL/calibration.json";
import commonNl from "./locales/nl-NL/common.json";
import connectionNl from "./locales/nl-NL/connection.json";
import experimentsNl from "./locales/nl-NL/experiments.json";
import homeNl from "./locales/nl-NL/home.json";
import measurementFlowNl from "./locales/nl-NL/measurement-flow.json";
import profileNl from "./locales/nl-NL/profile.json";
import recentMeasurementsNl from "./locales/nl-NL/recent-measurements.json";

export const SUPPORTED_LOCALES = ["en-US", "nl-NL"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const LANGUAGE_PREF_KEY = "openjii_language";
const FALLBACK_LOCALE: SupportedLocale = "en-US";

const bundledResources = {
  "en-US": {
    common: commonEn,
    auth: authEn,
    profile: profileEn,
    measurementFlow: measurementFlowEn,
    experiments: experimentsEn,
    calibration: calibrationEn,
    connection: connectionEn,
    recentMeasurements: recentMeasurementsEn,
    home: homeEn,
  },
  "nl-NL": {
    common: commonNl,
    auth: authNl,
    profile: profileNl,
    measurementFlow: measurementFlowNl,
    experiments: experimentsNl,
    calibration: calibrationNl,
    connection: connectionNl,
    recentMeasurements: recentMeasurementsNl,
    home: homeNl,
  },
} as const;

function pickDeviceLocale(): SupportedLocale {
  const deviceLocales = Localization.getLocales();
  for (const { languageTag } of deviceLocales) {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(languageTag)) {
      return languageTag as SupportedLocale;
    }
    // Match language code only (e.g. "nl" -> "nl-NL").
    const langOnly = languageTag.split("-")[0];
    const match = (SUPPORTED_LOCALES as readonly string[]).find((l) => l.startsWith(langOnly));
    if (match) return match as SupportedLocale;
  }
  return FALLBACK_LOCALE;
}

/**
 * Resolves the active locale at boot:
 *   user preference (AsyncStorage) > device locale > fallback.
 */
async function resolveInitialLocale(): Promise<SupportedLocale> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_PREF_KEY);
    if (saved && (SUPPORTED_LOCALES as readonly string[]).includes(saved)) {
      return saved as SupportedLocale;
    }
  } catch {
    /* ignore — fall through to device locale */
  }
  return pickDeviceLocale();
}

let initPromise: Promise<typeof i18next> | null = null;

export function initI18n(): Promise<typeof i18next> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const lng = await resolveInitialLocale();
    await i18next.use(initReactI18next).init({
      lng,
      fallbackLng: FALLBACK_LOCALE,
      ns: [
        "common",
        "auth",
        "profile",
        "measurementFlow",
        "experiments",
        "calibration",
        "connection",
        "recentMeasurements",
        "home",
      ],
      defaultNS: "common",
      resources: bundledResources,
      interpolation: { escapeValue: false },
      compatibilityJSON: "v4",
      returnNull: false,
    });
    return i18next;
  })();
  return initPromise;
}

/**
 * React hook that triggers i18n init at mount and reports readiness so the
 * root layout can gate rendering on it (the same way it gates on fonts +
 * migrations).
 */
export function useI18nReady(): boolean {
  const [ready, setReady] = useState(i18next.isInitialized);
  useEffect(() => {
    if (ready) return;
    void initI18n().then(() => setReady(true));
  }, [ready]);
  return ready;
}

/**
 * Switch the active language and persist the preference. Used by the
 * Profile/settings language switcher.
 */
export async function setLanguage(locale: SupportedLocale): Promise<void> {
  await i18next.changeLanguage(locale);
  try {
    await AsyncStorage.setItem(LANGUAGE_PREF_KEY, locale);
  } catch {
    /* persistence is best-effort; the in-memory change still takes effect */
  }
}

export { useTranslation } from "react-i18next";
export { default as i18n } from "i18next";
