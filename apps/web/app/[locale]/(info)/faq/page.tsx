import { draftMode } from "next/headers";
import { getContentfulClients } from "~/lib/contentful";

import { FaqContent } from "@repo/cms";
import type { PageFaqFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import type { Locale } from "@repo/i18n";

interface FaqPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function FaqPage({ params }: FaqPageProps) {
  const { locale } = await params;

  const { isEnabled: preview } = await draftMode();
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const faqQuery = await gqlClient.pageFaq({ locale, preview });
  const faq = faqQuery.pageFaqCollection?.items[0] as PageFaqFieldsFragment;

  return <FaqContent faq={faq} locale={locale} preview={preview} />;
}
