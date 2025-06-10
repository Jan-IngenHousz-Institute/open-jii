"use client";

import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { initReactI18next } from "react-i18next";

import { createInstance } from "@repo/i18n";
import type { InitTranslationsProps } from "@repo/i18n";

interface TranslationsProviderProps {
  children: ReactNode;
  locale: InitTranslationsProps["locale"];
  namespaces?: InitTranslationsProps["namespaces"];
  resources: InitTranslationsProps["resources"];
}

export function TranslationsProvider({
  children,
  locale,
  namespaces,
  resources,
}: TranslationsProviderProps) {
  const i18n = createInstance();

  // Add react-i18next plugin
  i18n.use(initReactI18next);

  // Initialize i18next with the resources from server-side
  // This is synchronous since we already have the resources
  i18n.init({
    lng: locale,
    resources,
    fallbackLng: "en-US",
    defaultNS: namespaces?.[0] || "common",
    ns: namespaces || ["common"],
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    react: {
      useSuspense: false,
    },
  });

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
