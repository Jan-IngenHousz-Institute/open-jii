import { draftMode } from "next/headers";
import { getContentfulClients } from "~/lib/contentful";

import { PoliciesContent } from "@repo/cms";
import type { PagePoliciesFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import type { Locale } from "@repo/i18n";

interface PoliciesPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function PoliciesPage({ params }: PoliciesPageProps) {
  const { locale } = await params;

  const { isEnabled: preview } = await draftMode();
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const policiesQuery = await gqlClient.pagePolicies({ locale, preview });
  const policies = policiesQuery.pagePoliciesCollection?.items[0] as PagePoliciesFieldsFragment;

  return <PoliciesContent policies={policies} locale={locale} preview={preview} />;
}
