"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { initReactI18next } from "react-i18next/initReactI18next";

import { createInstance } from "@repo/i18n";
import type { InitTranslationsProps, Locale } from "@repo/i18n";
import { fallbackLng, fallbackNS, i18nConfig } from "@repo/i18n/config";

interface TranslationsProviderProps {
  children: ReactNode;
  locale: Locale;
  namespaces?: InitTranslationsProps["namespaces"];
  resources?: InitTranslationsProps["resources"];
}

export function TranslationsProvider({
  children,
  locale,
  namespaces = ["common"],
  resources,
}: TranslationsProviderProps) {
  const i18nInstance = useMemo(() => {
    const instance = createInstance();
    instance.use(initReactI18next);

    // Since we have resources from the server, we can initialize synchronously
    instance.init({
      lng: locale,
      resources,
      fallbackLng,
      supportedLngs: i18nConfig.locales,
      defaultNS: namespaces[0],
      fallbackNS,
      ns: namespaces,
      preload: [],
      interpolation: {
        escapeValue: false, // React already does escaping
      },
      react: {
        useSuspense: false, // Important for SSR
      },
    });

    return instance;
  }, [locale, namespaces, resources]);

  return <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>;
}
