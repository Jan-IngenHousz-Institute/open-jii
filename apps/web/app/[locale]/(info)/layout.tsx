import { PublicNavbar } from "@/components/navigation/public-navbar";
import { NewsletterSubscribeForm } from "@/components/newsletter/newsletter-subscribe-form";
import { TranslationBundles } from "@/components/translation-bundles";
import { unstable_cache } from "next/cache";
import { draftMode } from "next/headers";
import React from "react";
import { HomeFooter } from "~/components/cms/footer";
import { PUBLISHED_CONTENT_SECONDS } from "~/lib/cms-cache";
import { buildTimeLocaleParams, getContentfulClients } from "~/lib/contentful";

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

async function fetchFooter(locale: string, preview: boolean) {
  const { previewClient, client } = await getContentfulClients();
  return (preview ? previewClient : client).footer({ locale, preview });
}

const getPublishedFooter = unstable_cache(
  (locale: string) => fetchFooter(locale, false),
  ["footer"],
  {
    revalidate: PUBLISHED_CONTENT_SECONDS,
  },
);

export default async function InfoGroupLayout({ children, params }: InfoLayoutProps) {
  const { isEnabled: preview } = await draftMode();
  const { locale } = await params;
  const bundles = await loadNamespaceBundles(locale, INFO_NAMESPACES);

  let footerData: FooterFieldsFragment | undefined;
  try {
    const footerQuery = await (preview ? fetchFooter(locale, true) : getPublishedFooter(locale));
    footerData = footerQuery.footerCollection?.items[0] as FooterFieldsFragment;
  } catch {
    // Contentful unavailable - render without footer
  }

  return (
    <TranslationBundles resources={bundles}>
      <PublicNavbar locale={locale} />
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
