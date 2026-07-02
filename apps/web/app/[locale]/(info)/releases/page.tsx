import { TranslationsProvider } from "@/components/translations-provider";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { getAllReleaseNotes } from "~/components/releases/fetch-public-release-notes";
import { ReleasesChangelog } from "~/components/releases/releases-changelog";

import { Container } from "@repo/cms/container";
import { defaultLocale, locales } from "@repo/i18n/config";
import initTranslations from "@repo/i18n/server";

interface ReleasesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ReleasesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["navigation"] });

  const languages = Object.fromEntries(
    locales.map((l) => [l, l === defaultLocale ? "/releases" : `/${l}/releases`]),
  );

  return {
    title: t("releases.metaTitle"),
    description: t("releases.metaDescription"),
    alternates: { canonical: "/releases", languages },
  };
}

/**
 * Public changelog (openjii.org/releases). Lists every active release note — the same
 * Contentful `ComponentReleaseNote` entries that power the in-app "What's new" feed — newest
 * first, grouped by month. Each note links to its own /releases/[slug] detail page.
 */
export default async function ReleasesPage({ params }: ReleasesPageProps) {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const { t, resources } = await initTranslations({ locale, namespaces: ["navigation"] });
  const entries = await getAllReleaseNotes(locale, preview);

  return (
    <TranslationsProvider locale={locale} namespaces={["navigation"]} resources={resources}>
      <Container className="max-w-4xl pb-20 pt-10 md:pt-14">
        <header className="mb-10 flex flex-col gap-2">
          <p className="text-primary font-mono text-xs font-medium uppercase tracking-[0.16em]">
            {t("releases.eyebrow")}
          </p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t("releases.heading")}</h1>
          <p className="text-muted-foreground max-w-2xl">{t("releases.subheading")}</p>
        </header>
        <ReleasesChangelog entries={entries} linkBaseHref={`/${locale}/releases`} />
      </Container>
    </TranslationsProvider>
  );
}
