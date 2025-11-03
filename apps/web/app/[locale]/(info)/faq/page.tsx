import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { getContentfulClients } from "~/lib/contentful";

import { FaqContent } from "@repo/cms";
import type { PageFaqFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import type { Locale } from "@repo/i18n";

interface FaqPageProps {
  params: Promise<{ locale: Locale }>;
}

async function getFaqData(locale: Locale, preview: boolean) {
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const faqQuery = await gqlClient.pageFaq({ locale, preview });
  return faqQuery.pageFaqCollection?.items[0] as PageFaqFieldsFragment;
}

export async function generateMetadata({ params }: FaqPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const faq = await getFaqData(locale, preview);

  const metadata: Metadata = {};

  if (faq.pageTitle) {
    metadata.title = faq.pageTitle as string;
  }

  if (faq.pageDescription) {
    metadata.description = faq.pageDescription as string;
  }

  return metadata;
}

export default async function FaqPage({ params }: FaqPageProps) {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const faq = await getFaqData(locale, preview);

  return <FaqContent faq={faq} locale={locale} preview={preview} />;
}
