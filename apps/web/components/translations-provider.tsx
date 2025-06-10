"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import type { i18n, Resource, Locale } from "@repo/i18n";

interface TranslationsContextType {
  locale: Locale;
  i18n: i18n;
  resources: Resource;
}

const TranslationsContext = createContext<TranslationsContextType | null>(null);

interface TranslationsProviderProps {
  children: ReactNode;
  locale: Locale;
  namespaces: string[];
  resources: Resource;
  i18n: i18n;
}

export function TranslationsProvider({
  children,
  locale,
  namespaces: _namespaces,
  resources,
  i18n,
}: TranslationsProviderProps) {
  return (
    <TranslationsContext.Provider
      value={{
        locale,
        i18n,
        resources,
      }}
    >
      {children}
    </TranslationsContext.Provider>
  );
}

export function useTranslationsContext() {
  const context = useContext(TranslationsContext);
  if (!context) {
    throw new Error(
      "useTranslationsContext must be used within TranslationsProvider",
    );
  }
  return context;
}
