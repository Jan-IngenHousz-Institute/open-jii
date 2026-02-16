import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { cache } from "react";
import { getContentfulClients } from "~/lib/contentful";

import { TermsAndConditionsPage } from "@repo/cms";
import type { PageTermsAndConditionsFieldsFragment } from "@repo/cms/lib/__generated/sdk";

interface TermsAndConditionsPageProps {
  params: Promise<{ locale: string }>;
}

const getTermsAndConditionsData = cache(async (locale: string, preview: boolean) => {
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const termsQuery = await gqlClient.pageTermsAndConditions({ locale, preview });
  return termsQuery.pageTermsAndConditionsCollection
    ?.items[0] as PageTermsAndConditionsFieldsFragment;
});

export async function generateMetadata({ params }: TermsAndConditionsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const termsAndConditions = await getTermsAndConditionsData(locale, preview);

  const metadata: Metadata = {};

  if (termsAndConditions.pageTitle) {
    metadata.title = termsAndConditions.pageTitle;
  }

  if (termsAndConditions.pageDescription) {
    metadata.description = termsAndConditions.pageDescription;
  }

  return metadata;
}

export default async function TermsAndConditionsPageRoute({ params }: TermsAndConditionsPageProps) {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const termsAndConditions = await getTermsAndConditionsData(locale, preview);

  return (
    <TermsAndConditionsPage
      termsAndConditions={termsAndConditions}
      locale={locale}
      preview={preview}
    />
  );
}
