import { TranslationBundles } from "@/components/translation-bundles";
import type { ReactNode } from "react";

import type { Namespace } from "@repo/i18n";
import { loadNamespaceBundles } from "@repo/i18n/server";

const WORKBOOK_NAMESPACES: Namespace[] = ["workbook", "experiments", "iot"];

interface WorkbooksLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function WorkbooksLayout({ children, params }: WorkbooksLayoutProps) {
  const { locale } = await params;
  const bundles = await loadNamespaceBundles(locale, WORKBOOK_NAMESPACES);

  return <TranslationBundles resources={bundles}>{children}</TranslationBundles>;
}
