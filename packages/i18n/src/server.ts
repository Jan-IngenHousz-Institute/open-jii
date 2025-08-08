import { createInstance } from "i18next";
import type { i18n, InitOptions } from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next/initReactI18next";

import { defaultNamespace, fallbackLng, fallbackNS, i18nConfig } from "./config";
import type { Locale, Namespace } from "./config";

export interface InitTranslationsProps {
  i18nInstance?: i18n;
  locale: Locale;
  namespaces?: Namespace[];
  resources?: InitOptions["resources"];
}

/**
 * Initialize i18next instance for server-side rendering
 * This function should be used in getStaticProps, getServerSideProps, or Server Components
 */
export default async function initTranslations({
  i18nInstance,
  locale,
  namespaces = [defaultNamespace],
  resources,
}: InitTranslationsProps) {
  i18nInstance = i18nInstance ?? createInstance();

  i18nInstance.use(initReactI18next);

  if (!resources) {
    i18nInstance.use(
      resourcesToBackend(
        (language: string, namespace: string) => import(`../locales/${language}/${namespace}.json`),
      ),
    );
  }

  // If resources are provided (client-side), initialize synchronously
  // Otherwise (server-side), initialize asynchronously
  if (resources) {
    void i18nInstance.init({
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
  } else {
    await i18nInstance.init({
      lng: locale,
      resources,
      fallbackLng,
      supportedLngs: i18nConfig.locales,
      defaultNS: namespaces[0],
      fallbackNS,
      ns: namespaces,
      preload: i18nConfig.locales,
      interpolation: {
        escapeValue: false, // React already does escaping
      },
      react: {
        useSuspense: false, // Important for SSR
      },
    });
  }

  return {
    i18n: i18nInstance,
    resources: i18nInstance.services.resourceStore.data,
    t: i18nInstance.t,
  };
}
