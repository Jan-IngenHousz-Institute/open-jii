import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { cache } from "react";
import { getContentfulClients } from "~/lib/contentful";

import { FaqContent } from "@repo/cms";
import type { PageFaqFieldsFragment } from "@repo/cms/lib/__generated/sdk";

interface FaqPageProps {
  params: Promise<{ locale: string }>;
}

const getFaqData = cache(async (locale: string, preview: boolean) => {
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const faqQuery = await gqlClient.pageFaq({ locale, preview });
  return faqQuery.pageFaqCollection?.items[0] as PageFaqFieldsFragment;
});

export async function generateMetadata({ params }: FaqPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const faq = await getFaqData(locale, preview);

  const metadata: Metadata = {};

  if (faq.pageTitle) {
    metadata.title = faq.pageTitle;
  }

  if (faq.pageDescription) {
    metadata.description = faq.pageDescription;
  }

  return metadata;
}

export default async function FaqPage({ params }: FaqPageProps) {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const faq = await getFaqData(locale, preview);

  return <FaqContent faq={faq} locale={locale} preview={preview} />;
}
