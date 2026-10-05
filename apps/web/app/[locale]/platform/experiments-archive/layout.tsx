import { TranslationBundles } from "@/components/translation-bundles";
import type { ReactNode } from "react";

import type { Namespace } from "@repo/i18n";
import { loadNamespaceBundles } from "@repo/i18n/server";

const EXPERIMENT_NAMESPACES: Namespace[] = [
  "experiments",
  "experimentData",
  "experimentVisualizations",
  "experimentDashboards",
  "workbook",
  "publicMetrics",
];

interface ExperimentsArchiveLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function ExperimentsArchiveLayout({
  children,
  params,
}: ExperimentsArchiveLayoutProps) {
  const { locale } = await params;
  const bundles = await loadNamespaceBundles(locale, EXPERIMENT_NAMESPACES);

  return <TranslationBundles resources={bundles}>{children}</TranslationBundles>;
}
