import { TranslationsProvider } from "@/components/translations-provider";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllReleaseNotes,
  getReleaseNoteBySlug,
} from "~/components/releases/fetch-public-release-notes";
import { ReleaseNav } from "~/components/releases/release-nav";
import { safeMetadata } from "~/lib/safe-metadata";

import { ReleaseNoteArticle } from "@repo/cms";
import { Container } from "@repo/cms/container";
import { defaultLocale } from "@repo/i18n/config";
import initTranslations from "@repo/i18n/server";

interface ReleaseDetailPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export function generateMetadata({ params }: ReleaseDetailPageProps): Promise<Metadata> {
  return safeMetadata(async () => {
    const { locale, slug } = await params;
    const { isEnabled: preview } = await draftMode();
    const entry = await getReleaseNoteBySlug(locale, slug, preview);

    // Only the default locale is guaranteed while locale availability is request-time flagged.
    const languages = { [defaultLocale]: `/${defaultLocale}/releases/${slug}` };
    const metadata: Metadata = {
      alternates: {
        canonical: `/${locale}/releases/${slug}`,
        languages,
      },
    };

    if (entry?.seoFields) {
      metadata.title = entry.seoFields.pageTitle;
      metadata.description = entry.seoFields.pageDescription;
      metadata.robots = {
        follow: !entry.seoFields.nofollow,
        index: !entry.seoFields.noindex,
      };
    } else if (entry) {
      // No ComponentSeo authored — fall back to the note's own title/summary.
      metadata.title = entry.title;
      metadata.description = entry.summary;
    }

    return metadata;
  });
}

/** Public per-note permalink (openjii.org/releases/[slug]). */
export default async function ReleaseDetailPage({ params }: ReleaseDetailPageProps) {
  const { locale, slug } = await params;
  const { isEnabled: preview } = await draftMode();
  const { t, resources } = await initTranslations({ locale, namespaces: ["navigation"] });
  const [entry, all] = await Promise.all([
    getReleaseNoteBySlug(locale, slug, preview),
    getAllReleaseNotes(locale, preview),
  ]);

  if (!entry) {
    notFound();
  }

  // Neighbours for prev/next. `all` is newest-first, so the newer note sits at index-1 ("Next") and
  // the older note at index+1 ("Previous"). A slug with no title falls back to its slug.
  const currentIndex = all.findIndex((note) => note.slug === entry.slug);
  const toNeighbor = (note: (typeof all)[number] | undefined) =>
    note?.slug ? { slug: note.slug, title: note.title ?? note.slug } : null;
  const newer = currentIndex > 0 ? toNeighbor(all[currentIndex - 1]) : null;
  const older =
    currentIndex >= 0 && currentIndex < all.length - 1 ? toNeighbor(all[currentIndex + 1]) : null;

  return (
    <TranslationsProvider locale={locale} namespaces={["navigation"]} resources={resources}>
      <div className="py-16 md:py-20">
        <Container className="max-w-4xl">
          <Link
            href={`/${locale}/releases`}
            className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="size-4" />
            {t("releases.backToReleases")}
          </Link>
          <ReleaseNoteArticle entry={entry} />
          <ReleaseNav
            locale={locale}
            previous={older}
            next={newer}
            previousLabel={t("releases.previous")}
            nextLabel={t("releases.next")}
          />
        </Container>
      </div>
    </TranslationsProvider>
  );
}
