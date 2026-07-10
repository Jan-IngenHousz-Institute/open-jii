"use client";

import { useMarkWhatsNewSeen } from "@/hooks/whats-new/useMarkWhatsNewSeen/useMarkWhatsNewSeen";
import { useWhatsNewLastSeen } from "@/hooks/whats-new/useWhatsNewLastSeen/useWhatsNewLastSeen";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { env } from "~/env";

import type { ComponentReleaseNoteFieldsFragment as ReleaseNoteFields } from "@repo/cms";
import { ReleaseNotesFeed } from "@repo/cms";
import { useCurrentLocale, useTranslation } from "@repo/i18n";
import i18nConfig from "@repo/i18n/config";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";

import { WHATS_NEW_OPEN_EVENT, countUnread } from "./whats-new-shared";

/** Right-side 480px panel listing release notes, grouped by month, with a "Full changelog" link. */
export function WhatsNewSheet({ entries }: { entries: ReleaseNoteFields[] }) {
  const { t } = useTranslation("navigation");
  const locale = useCurrentLocale(i18nConfig) ?? "en-US";
  // Same-app origin (env, not a hardcoded domain), locale in the path so the proxy doesn't redirect
  // an unprefixed URL to the default locale.
  const releasesBaseUrl = `${env.NEXT_PUBLIC_BASE_URL}/${locale}/releases`;
  const lastSeen = useWhatsNewLastSeen();
  const markSeen = useMarkWhatsNewSeen();
  const [isOpen, setIsOpen] = React.useState(false);

  // Opened by the footer item / `G R` shortcut via a window event (no shared context needed).
  React.useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener(WHATS_NEW_OPEN_EVENT, handler);
    return () => window.removeEventListener(WHATS_NEW_OPEN_EVENT, handler);
  }, []);

  const handleOpenChange = (next: boolean) => {
    setIsOpen(next);
    // On close, stamp "seen" (cross-device) only when something was actually unread.
    if (!next && countUnread(entries, lastSeen.data?.body.lastSeenAt ?? null) > 0) {
      markSeen.mutate({ body: {} });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="sm:max-w-120 flex w-full flex-col gap-0 p-0">
        <SheetHeader className="border-border border-b px-6 py-4">
          <SheetTitle>{t("whatsNew.title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("whatsNew.description")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <ReleaseNotesFeed
            entries={entries}
            linkBaseHref={releasesBaseUrl}
            linkTarget="_blank"
            variant="sheet"
          />
        </div>

        <div className="border-border border-t px-6 py-4">
          <Link
            href={releasesBaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          >
            {t("whatsNew.fullChangelog")}
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
