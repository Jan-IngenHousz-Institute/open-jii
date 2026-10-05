import { createInstance } from "i18next";
import type { i18n, InitOptions, Resource } from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { cache } from "react";
import { initReactI18next } from "react-i18next/initReactI18next";

import { defaultNamespace, fallbackLng, fallbackNS, i18nConfig, isKnownLocale } from "./config";
import type { Namespace } from "./config";

export interface InitTranslationsProps {
  i18nInstance?: i18n;
  locale: string;
  namespaces?: Namespace[];
  resources?: InitOptions["resources"];
}

// One file per locale and namespace, loaded only when a render asks for it.
const localeFiles = () =>
  resourcesToBackend(
    (language: string, namespace: string) => import(`../locales/${language}/${namespace}.json`),
  );

function sharedOptions(locale: string, namespaces: Namespace[]): InitOptions {
  return {
    lng: isKnownLocale(locale) ? locale : fallbackLng,
    fallbackLng,
    supportedLngs: i18nConfig.locales,
    defaultNS: namespaces[0],
    fallbackNS,
    ns: namespaces,
    interpolation: {
      escapeValue: false, // React already does escaping
    },
  };
}

// Several components in one request ask for the same locale and namespaces; they share an instance.
const loadServerTranslations = cache(async (locale: string, ...namespaces: Namespace[]) => {
  const instance = createInstance();
  instance.use(initReactI18next).use(localeFiles());
  await instance.init({ ...sharedOptions(locale, namespaces), react: { useSuspense: false } });
  return instance;
});

/**
 * Server: loads the namespaces in the render's locale and its fallback.
 * Client (`resources` given): starts from the bundles the server handed over and
 * loads any other namespace on demand, suspending the component that asked.
 */
export default async function initTranslations({
  i18nInstance,
  locale,
  namespaces = [defaultNamespace],
  resources,
}: InitTranslationsProps) {
  if (!resources) {
    const instance = await loadServerTranslations(locale, ...namespaces);
    return { i18n: instance, resources: instance.services.resourceStore.data, t: instance.t };
  }

  const instance = i18nInstance ?? createInstance();
  instance.use(initReactI18next).use(localeFiles());
  void instance.init({
    ...sharedOptions(locale, namespaces),
    resources,
    partialBundledLanguages: true,
    // The bundles are already here, so the first render need not wait for init.
    initAsync: false,
    react: { useSuspense: true },
  });

  return { i18n: instance, resources: instance.services.resourceStore.data, t: instance.t };
}

/** The bundles of exactly these namespaces, for a route segment to hand to its client components. */
export async function loadNamespaceBundles(
  locale: string,
  namespaces: Namespace[],
): Promise<Resource> {
  const { resources } = await initTranslations({ locale, namespaces });
  const wanted = new Set<string>(namespaces);

  return Object.fromEntries(
    Object.entries(resources).map(([language, bundles]) => [
      language,
      Object.fromEntries(Object.entries(bundles).filter(([namespace]) => wanted.has(namespace))),
    ]),
  );
}
