import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { getContentfulClients } from "~/lib/contentful";

import { AboutContent } from "@repo/cms";
import type { PageAboutFieldsFragment } from "@repo/cms/lib/__generated/sdk";

interface AboutPageProps {
  params: Promise<{ locale: string }>;
}

async function getAboutData(locale: string, preview: boolean) {
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
    metadata.title = about.pageTitle;
  }

  if (about.pageDescription) {
    metadata.description = about.pageDescription;
  }

  return metadata;
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const about = await getAboutData(locale, preview);

  return <AboutContent about={about} locale={locale} preview={preview} />;
}
