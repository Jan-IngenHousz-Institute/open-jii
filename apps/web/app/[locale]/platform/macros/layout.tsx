import { TranslationBundles } from "@/components/translation-bundles";
import type { ReactNode } from "react";

import type { Namespace } from "@repo/i18n";
import { loadNamespaceBundles } from "@repo/i18n/server";

const MACRO_NAMESPACES: Namespace[] = ["macro"];

interface MacrosLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function MacrosLayout({ children, params }: MacrosLayoutProps) {
  const { locale } = await params;
  const bundles = await loadNamespaceBundles(locale, MACRO_NAMESPACES);

  return <TranslationBundles resources={bundles}>{children}</TranslationBundles>;
}
