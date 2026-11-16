import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { cache } from "react";
import { getTermsAndConditions } from "~/components/cms/fetch-terms-and-conditions";
import { TermsAndConditionsPage } from "~/components/cms/terms-and-conditions";
import { safeMetadata } from "~/lib/safe-metadata";

import type { PageTermsAndConditionsFieldsFragment } from "@repo/cms/lib/__generated/sdk";

interface TermsAndConditionsPageProps {
  params: Promise<{ locale: string }>;
}

const getTermsAndConditionsData = cache(async (locale: string, preview: boolean) => {
  const termsQuery = await getTermsAndConditions(locale, preview);
  return termsQuery.pageTermsAndConditionsCollection
    ?.items[0] as PageTermsAndConditionsFieldsFragment;
});

export function generateMetadata({ params }: TermsAndConditionsPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
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
  });
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
