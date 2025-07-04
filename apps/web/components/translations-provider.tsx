"use client";

import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

import { createInstance, initTranslations } from "@repo/i18n";
import type { InitTranslationsProps } from "@repo/i18n";

interface TranslationProviderProps {
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
}: TranslationProviderProps) {
  const i18n = createInstance();

  void initTranslations({ locale, namespaces, i18nInstance: i18n, resources });

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
