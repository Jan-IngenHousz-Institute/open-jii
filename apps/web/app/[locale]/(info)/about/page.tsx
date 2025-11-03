import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { getContentfulClients } from "~/lib/contentful";

import { AboutContent } from "@repo/cms";
import type { PageAboutFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import type { Locale } from "@repo/i18n";

interface AboutPageProps {
  params: Promise<{ locale: Locale }>;
}

async function getAboutData(locale: Locale, preview: boolean) {
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const aboutQuery = await gqlClient.pageAbout({ locale, preview });
  return aboutQuery.pageAboutCollection?.items[0] as PageAboutFieldsFragment;
}

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const about = await getAboutData(locale, preview);

  const metadata: Metadata = {};

  if (about.pageTitle) {
    metadata.title = about.pageTitle as string;
  }

  if (about.pageDescription) {
    metadata.description = about.pageDescription as string;
  }

  return metadata;
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const about = await getAboutData(locale, preview);

  return <AboutContent about={about} locale={locale} preview={preview} />;
}
