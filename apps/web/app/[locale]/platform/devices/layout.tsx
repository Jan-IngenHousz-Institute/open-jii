import { DevicesLayoutShell } from "@/components/iot-devices/devices-layout-shell";
import { TranslationBundles } from "@/components/translation-bundles";
import type { ReactNode } from "react";

import type { Namespace } from "@repo/i18n";
import { loadNamespaceBundles } from "@repo/i18n/server";

const DEVICE_NAMESPACES: Namespace[] = ["iot", "experiments"];

interface DevicesLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function DevicesLayout({ children, params }: DevicesLayoutProps) {
  const { locale } = await params;
  const bundles = await loadNamespaceBundles(locale, DEVICE_NAMESPACES);

  return (
    <TranslationBundles resources={bundles}>
      <DevicesLayoutShell>{children}</DevicesLayoutShell>
    </TranslationBundles>
  );
}
