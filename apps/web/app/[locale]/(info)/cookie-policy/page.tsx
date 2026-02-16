import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { cache } from "react";
import { getContentfulClients } from "~/lib/contentful";

import { CookiePolicyContent } from "@repo/cms";
import type { PageCookiePolicyFieldsFragment } from "@repo/cms/lib/__generated/sdk";

interface CookiePolicyPageProps {
  params: Promise<{ locale: string }>;
}

const getCookiePolicyData = cache(async (locale: string, preview: boolean) => {
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const cookiePolicyQuery = await gqlClient.pageCookiePolicy({ locale, preview });
  return cookiePolicyQuery.pageCookiePolicyCollection?.items[0] as PageCookiePolicyFieldsFragment;
});

export async function generateMetadata({ params }: CookiePolicyPageProps): Promise<Metadata> {
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
}

export default async function CookiePolicyPage({ params }: CookiePolicyPageProps) {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const cookiePolicy = await getCookiePolicyData(locale, preview);

  return <CookiePolicyContent cookiePolicy={cookiePolicy} locale={locale} preview={preview} />;
}
