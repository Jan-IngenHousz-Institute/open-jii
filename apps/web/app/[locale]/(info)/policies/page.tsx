import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { draftMode } from "next/headers";
import { cache } from "react";
import { PoliciesContent } from "~/components/cms/policies";
import { PUBLISHED_CONTENT_SECONDS } from "~/lib/cms-cache";
import { getContentfulClients } from "~/lib/contentful";
import { safeMetadata } from "~/lib/safe-metadata";

import type { PagePoliciesFieldsFragment } from "@repo/cms/lib/__generated/sdk";

interface PoliciesPageProps {
  params: Promise<{ locale: string }>;
}

async function fetchPolicies(locale: string, preview: boolean) {
  const { previewClient, client } = await getContentfulClients();
  return (preview ? previewClient : client).pagePolicies({ locale, preview });
}

const getPublishedPolicies = unstable_cache(
  (locale: string) => fetchPolicies(locale, false),
  ["pagePolicies"],
  {
    revalidate: PUBLISHED_CONTENT_SECONDS,
  },
);

const getPoliciesData = cache(async (locale: string, preview: boolean) => {
  const policiesQuery = await (preview
    ? fetchPolicies(locale, true)
    : getPublishedPolicies(locale));
  return policiesQuery.pagePoliciesCollection?.items[0] as PagePoliciesFieldsFragment;
});

export function generateMetadata({ params }: PoliciesPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
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
  });
}

export default async function PoliciesPage({ params }: PoliciesPageProps) {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const policies = await getPoliciesData(locale, preview);

  return <PoliciesContent policies={policies} locale={locale} preview={preview} />;
}
