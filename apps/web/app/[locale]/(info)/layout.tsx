import { UnifiedNavbar } from "@/components/navigation/unified-navbar/unified-navbar";
import { NewsletterSubscribeForm } from "@/components/newsletter/newsletter-subscribe-form";
import { TranslationBundles } from "@/components/translation-bundles";
import { draftMode } from "next/headers";
import React from "react";
import { buildTimeLocaleParams, getContentfulClients } from "~/lib/contentful";

import { HomeFooter } from "@repo/cms";
import type { FooterFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import type { Namespace } from "@repo/i18n";
import { loadNamespaceBundles } from "@repo/i18n/server";
import { Toaster } from "@repo/ui/components/toaster";

const INFO_NAMESPACES: Namespace[] = ["navigation", "newsletter"];

interface InfoLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

// Regenerated at most this often; matches the alerts bar's 300 s cache. A literal, as Next requires.
export const revalidate = 300;

export const generateStaticParams = buildTimeLocaleParams;

export default async function InfoGroupLayout({ children, params }: InfoLayoutProps) {
  const { isEnabled: preview } = await draftMode();
  const { locale } = await params;
  const bundles = await loadNamespaceBundles(locale, INFO_NAMESPACES);

  let footerData: FooterFieldsFragment | undefined;
  try {
    const { previewClient, client } = await getContentfulClients();
    const gqlClient = preview ? previewClient : client;
    const footerQuery = await gqlClient.footer({ locale, preview });
    footerData = footerQuery.footerCollection?.items[0] as FooterFieldsFragment;
  } catch {
    // Contentful unavailable - render without footer
  }

  return (
    <TranslationBundles resources={bundles}>
      <UnifiedNavbar locale={locale} />
      <div className="mx-auto flex w-full max-w-7xl justify-center">
        <main className="flex min-h-screen w-full flex-col px-2">{children}</main>
      </div>
      {footerData && (
        <HomeFooter
          footerData={footerData}
          preview={preview}
          locale={locale}
          newsletterSlot={<NewsletterSubscribeForm />}
        />
      )}
      <Toaster />
    </TranslationBundles>
  );
}
