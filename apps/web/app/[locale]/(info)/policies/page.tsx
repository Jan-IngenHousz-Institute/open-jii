import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { cache } from "react";
import { getContentfulClients } from "~/lib/contentful";

import { PoliciesContent } from "@repo/cms";
import type { PagePoliciesFieldsFragment } from "@repo/cms/lib/__generated/sdk";

interface PoliciesPageProps {
  params: Promise<{ locale: string }>;
}

const getPoliciesData = cache(async (locale: string, preview: boolean) => {
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const policiesQuery = await gqlClient.pagePolicies({ locale, preview });
  return policiesQuery.pagePoliciesCollection?.items[0] as PagePoliciesFieldsFragment;
});

export async function generateMetadata({ params }: PoliciesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const policies = await getPoliciesData(locale, preview);

  const metadata: Metadata = {};

  if (policies.pageTitle) {
    metadata.title = policies.pageTitle;
  }

  if (policies.pageDescription) {
    metadata.description = policies.pageDescription;
  }

  return metadata;
}

export default async function PoliciesPage({ params }: PoliciesPageProps) {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const policies = await getPoliciesData(locale, preview);

  return <PoliciesContent policies={policies} locale={locale} preview={preview} />;
}
