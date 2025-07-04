import { draftMode } from "next/headers";
import { getContentfulClients } from "~/lib/contentful";

import { AboutContent } from "@repo/cms";
import type { PageAboutFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import type { Locale } from "@repo/i18n";

interface AboutPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;

  const { isEnabled: preview } = await draftMode();
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const aboutQuery = await gqlClient.pageAbout({ locale, preview });
  const about = aboutQuery.pageAboutCollection?.items[0] as PageAboutFieldsFragment;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 pb-24 pt-8">
      <AboutContent about={about} locale={locale} preview={preview} />
    </main>
  );
}
