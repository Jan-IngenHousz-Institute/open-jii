"use client";

import type { ReactNode } from "react";

import { useTranslation } from "@repo/i18n";
import type { Resource } from "@repo/i18n";

interface TranslationBundlesProps {
  resources: Resource;
  children: ReactNode;
}

/** Adds a route segment's namespaces to the page's i18n instance before its children render. */
export function TranslationBundles({ resources, children }: TranslationBundlesProps) {
  const { i18n } = useTranslation();

  // Idempotent, so a repeat render or a namespace two segments share does no harm. It is the
  // same write react-i18next's own `useSSR` makes during render.
  for (const [language, bundles] of Object.entries(resources)) {
    for (const [namespace, bundle] of Object.entries(bundles)) {
      if (!i18n.hasResourceBundle(language, namespace)) {
        i18n.addResourceBundle(language, namespace, bundle);
      }
    }
  }

  return children;
}
