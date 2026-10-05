import { TranslationBundles } from "@/components/translation-bundles";
import type { ReactNode } from "react";

import type { Namespace } from "@repo/i18n";
import { loadNamespaceBundles } from "@repo/i18n/server";

const PROTOCOL_NAMESPACES: Namespace[] = ["iot"];

interface ProtocolsLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function ProtocolsLayout({ children, params }: ProtocolsLayoutProps) {
  const { locale } = await params;
  const bundles = await loadNamespaceBundles(locale, PROTOCOL_NAMESPACES);

  return <TranslationBundles resources={bundles}>{children}</TranslationBundles>;
}
