"use client";

import { ErrorDisplay } from "@/components/error-display";
import { PageLoading } from "@/components/shared/page-loading";
import { useReleaseNotes } from "@/hooks/whats-new/useReleaseNotes/useReleaseNotes";

import { ReleaseNotesFeed } from "@repo/cms/release-notes-feed";
import { useTranslation } from "@repo/i18n";

/** The sheet's list of notes, loaded with its rich-text renderer only once the sheet opens. */
export function WhatsNewFeed({
  locale,
  releasesBaseUrl,
}: {
  locale: string;
  releasesBaseUrl: string;
}) {
  const { t } = useTranslation("navigation");
  const { data, error, isPending } = useReleaseNotes(locale);

  if (isPending) {
    return <PageLoading />;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("whatsNew.loadError")} />;
  }

  return (
    <ReleaseNotesFeed
      entries={data}
      linkBaseHref={releasesBaseUrl}
      linkTarget="_blank"
      variant="sheet"
    />
  );
}
