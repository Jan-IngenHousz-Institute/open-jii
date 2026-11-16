import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { draftMode } from "next/headers";
import { cache } from "react";
import { FaqContent } from "~/components/cms/faq";
import { PUBLISHED_CONTENT_SECONDS } from "~/lib/cms-cache";
import { getContentfulClients } from "~/lib/contentful";
import { safeMetadata } from "~/lib/safe-metadata";

import type { PageFaqFieldsFragment } from "@repo/cms/lib/__generated/sdk";

interface FaqPageProps {
  params: Promise<{ locale: string }>;
}

async function fetchFaq(locale: string, preview: boolean) {
  const { previewClient, client } = await getContentfulClients();
  return (preview ? previewClient : client).pageFaq({ locale, preview });
}

const getPublishedFaq = unstable_cache((locale: string) => fetchFaq(locale, false), ["pageFaq"], {
  revalidate: PUBLISHED_CONTENT_SECONDS,
});

const getFaqData = cache(async (locale: string, preview: boolean) => {
  const faqQuery = await (preview ? fetchFaq(locale, true) : getPublishedFaq(locale));
  return faqQuery.pageFaqCollection?.items[0] as PageFaqFieldsFragment;
});

export function generateMetadata({ params }: FaqPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
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
  });
}

export default async function FaqPage({ params }: FaqPageProps) {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const faq = await getFaqData(locale, preview);

  return <FaqContent faq={faq} locale={locale} preview={preview} />;
}
