"use client";

import { usePathname } from "next/navigation";
import { use } from "react";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

import { initTranslations } from "@repo/i18n";
import type { InitTranslationsProps, Locale } from "@repo/i18n";

interface TranslationsProviderProps {
  children: ReactNode;
  namespaces?: InitTranslationsProps["namespaces"];
}

export function TranslationsProvider({
  children,
  namespaces,
}: TranslationsProviderProps) {
  const pathname = usePathname();
  const locale = (pathname.split("/")[1] || "en-US") as Locale; // Default to 'en' if locale is not found
  const { i18n } = use(
    initTranslations({
      locale,
      namespaces,
    }),
  );

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
