import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { getContentfulClients } from "~/lib/contentful";

import { PoliciesContent } from "@repo/cms";
import type { PagePoliciesFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import type { Locale } from "@repo/i18n";

interface PoliciesPageProps {
  params: Promise<{ locale: Locale }>;
}

async function getPoliciesData(locale: Locale, preview: boolean) {
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const policiesQuery = await gqlClient.pagePolicies({ locale, preview });
  return policiesQuery.pagePoliciesCollection?.items[0] as PagePoliciesFieldsFragment;
}

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
