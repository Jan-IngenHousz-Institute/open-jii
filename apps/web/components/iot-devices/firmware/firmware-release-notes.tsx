"use client";

import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { cn } from "@repo/ui/lib/utils";

interface FirmwareReleaseNotesProps {
  /** GitHub's sanitized HTML rendering of the release body. */
  notesHtml: string | null;
}

/**
 * One release's notes as GitHub already rendered them, shown by the platform's
 * existing rich-text renderer. The repositories are first-party configuration,
 * and GitHub's pipeline sanitizes the HTML it serves. Long notes clamp behind
 * a fade rather than a line cut, since HTML cannot be split mid-list.
 */
export function FirmwareReleaseNotes({ notesHtml }: FirmwareReleaseNotesProps) {
  const { t } = useTranslation("iot");
  const [expanded, setExpanded] = useState(false);

  if (notesHtml === null || notesHtml.trim() === "") {
    return <p className="text-muted-foreground text-xs">{t("iot.devices.firmware.noNotes")}</p>;
  }

  // Block elements approximate rendered lines well enough to decide clamping.
  const blockCount = (notesHtml.match(/<(p|li|h[1-6]|pre|blockquote)\b/g) ?? []).length;
  const isLong = blockCount > 8;
  const isClamped = isLong && !expanded;

  return (
    <div>
      <div className={cn("relative", isClamped && "max-h-44 overflow-hidden")}>
        {/* GitHub's changelog headings arrive as h1-h3 and would outrank the row
            header above; inside a release row they are section labels, not titles. */}
        <RichTextRenderer
          content={notesHtml}
          className="text-sm [&_h1]:mb-1 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold"
        />
        {isClamped && (
          <div
            className="from-card absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t to-transparent"
            aria-hidden
          />
        )}
      </div>
      {isLong && (
        <button
          type="button"
          className="text-muted-foreground pt-1 text-xs underline underline-offset-4"
          onClick={() => {
            setExpanded((value) => !value);
          }}
        >
          {expanded
            ? t("iot.devices.firmware.showLessNotes")
            : t("iot.devices.firmware.showAllNotes")}
        </button>
      )}
    </div>
  );
}
