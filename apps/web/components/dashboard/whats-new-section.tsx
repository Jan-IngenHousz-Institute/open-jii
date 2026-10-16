"use client";

import { WHATS_NEW_OPEN_EVENT } from "@/components/whats-new/whats-new-shared";

import { useTranslation } from "@repo/i18n";

import { DashboardSection } from "./dashboard-section";
import { seeAllClassName } from "./see-all-link";

export interface WhatsNewEntry {
  id: string;
  title: string;
  publishedAt: string;
}

interface WhatsNewSectionProps {
  entries: WhatsNewEntry[];
  locale: string;
}

/** The newest release notes by title; See all opens the What's new panel beside the page. */
export function WhatsNewSection({ entries, locale }: WhatsNewSectionProps) {
  const { t } = useTranslation();
  const { t: tNavigation } = useTranslation("navigation");

  if (entries.length === 0) return null;

  // Release notes carry a day, not a moment, so UTC renders the same on the server and here.
  const day = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });

  const openPanel = () => window.dispatchEvent(new Event(WHATS_NEW_OPEN_EVENT));

  const renderEntry = (entry: WhatsNewEntry) => (
    <li key={entry.id} className="flex items-baseline justify-between gap-3">
      <span className="text-foreground min-w-0">{entry.title}</span>
      <time dateTime={entry.publishedAt} className="text-muted-foreground shrink-0 text-xs">
        {day.format(new Date(entry.publishedAt))}
      </time>
    </li>
  );

  return (
    <DashboardSection
      id="whats-new"
      title={tNavigation("whatsNew.navLabel")}
      action={
        <button type="button" onClick={openPanel} className={seeAllClassName}>
          {t("dashboard.seeAll")}
        </button>
      }
    >
      <ul className="flex flex-col gap-2 text-sm">{entries.map(renderEntry)}</ul>
    </DashboardSection>
  );
}
