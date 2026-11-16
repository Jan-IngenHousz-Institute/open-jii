import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { draftMode } from "next/headers";
import { cache } from "react";
import { CookiePolicyContent } from "~/components/cms/cookie-policy";
import { PUBLISHED_CONTENT_SECONDS } from "~/lib/cms-cache";
import { getContentfulClients } from "~/lib/contentful";
import { safeMetadata } from "~/lib/safe-metadata";

import type { PageCookiePolicyFieldsFragment } from "@repo/cms/lib/__generated/sdk";

interface CookiePolicyPageProps {
  params: Promise<{ locale: string }>;
}

async function fetchCookiePolicy(locale: string, preview: boolean) {
  const { previewClient, client } = await getContentfulClients();
  return (preview ? previewClient : client).pageCookiePolicy({ locale, preview });
}

const getPublishedCookiePolicy = unstable_cache(
  (locale: string) => fetchCookiePolicy(locale, false),
  ["pageCookiePolicy"],
  {
    revalidate: PUBLISHED_CONTENT_SECONDS,
  },
);

const getCookiePolicyData = cache(async (locale: string, preview: boolean) => {
  const cookiePolicyQuery = await (preview
    ? fetchCookiePolicy(locale, true)
    : getPublishedCookiePolicy(locale));
  return cookiePolicyQuery.pageCookiePolicyCollection?.items[0] as PageCookiePolicyFieldsFragment;
});

export function generateMetadata({ params }: CookiePolicyPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale } = await params;
    const { isEnabled: preview } = await draftMode();
    const cookiePolicy = await getCookiePolicyData(locale, preview);

    const metadata: Metadata = {};

    if (cookiePolicy.pageTitle) {
      metadata.title = cookiePolicy.pageTitle;
    }

    if (cookiePolicy.pageDescription) {
      metadata.description = cookiePolicy.pageDescription;
    }

    return metadata;
  });
}

export default async function CookiePolicyPage({ params }: CookiePolicyPageProps) {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const cookiePolicy = await getCookiePolicyData(locale, preview);

  return <CookiePolicyContent cookiePolicy={cookiePolicy} locale={locale} preview={preview} />;
}
