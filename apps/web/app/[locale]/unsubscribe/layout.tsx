import { TranslationBundles } from "@/components/translation-bundles";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { loadNamespaceBundles } from "@repo/i18n/server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Outside `(info)` and `(auth)`, like the join landing: the reader arrives from an email, signed out. */
export default async function UnsubscribeLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const bundles = await loadNamespaceBundles(locale, ["notifications"]);

  return (
    <TranslationBundles resources={bundles}>
      <main className="flex min-h-screen w-full items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </TranslationBundles>
  );
}
