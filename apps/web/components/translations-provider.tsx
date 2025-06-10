"use client";

import { use } from "react";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

import { initTranslations } from "@repo/i18n";
import type { InitTranslationsProps } from "@repo/i18n";

interface TranslationsProviderProps {
  children: ReactNode;
  locale: InitTranslationsProps["locale"];
  namespaces?: InitTranslationsProps["namespaces"];
}

export function TranslationsProvider({
  children,
  locale,
  namespaces,
}: TranslationsProviderProps) {
  const { i18n } = use(
    initTranslations({
      locale,
      namespaces,
    }),
  );

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
