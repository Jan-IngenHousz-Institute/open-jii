"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatShortDate } from "@/util/date";
import { isSameFirmwareVersion } from "@/util/firmware-family";
import { Download, ExternalLink } from "lucide-react";

import type { FirmwareRelease } from "@repo/api/domains/iot/firmware/iot-firmware.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";

/** Beyond this, notes collapse behind a toggle rather than flooding the tab. */
const NOTES_PREVIEW_LINES = 8;

interface FirmwareReleaseListProps {
  releases: FirmwareRelease[];
  /** Version the device last reported, so its own release is marked. */
  installedVersion: string | null;
}

function formatBytes(sizeBytes: number): string {
  return `${String(Math.max(1, Math.round(sizeBytes / 1024)))} KB`;
}

export function FirmwareReleaseList({ releases, installedVersion }: FirmwareReleaseListProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  function renderNotes(release: FirmwareRelease) {
    if (release.notes === null || release.notes.trim() === "") {
      return <p className="text-muted-foreground text-xs">{t("iot.devices.firmware.noNotes")}</p>;
    }

    const lines = release.notes.split("\n");
    if (lines.length <= NOTES_PREVIEW_LINES) {
      return <pre className="whitespace-pre-wrap font-sans text-xs">{release.notes}</pre>;
    }

    return (
      <Collapsible>
        <pre className="whitespace-pre-wrap font-sans text-xs">
          {lines.slice(0, NOTES_PREVIEW_LINES).join("\n")}
        </pre>
        <CollapsibleContent>
          <pre className="whitespace-pre-wrap font-sans text-xs">
            {lines.slice(NOTES_PREVIEW_LINES).join("\n")}
          </pre>
        </CollapsibleContent>
        <CollapsibleTrigger className="text-muted-foreground pt-1 text-xs underline">
          {t("iot.devices.firmware.showAllNotes")}
        </CollapsibleTrigger>
      </Collapsible>
    );
  }

  function renderRelease(release: FirmwareRelease) {
    const isInstalled =
      installedVersion !== null && isSameFirmwareVersion(installedVersion, release.version);

    return (
      <li key={release.version} className="space-y-2 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium">{release.version}</span>
          {release.latest && <Badge variant="secondary">{t("iot.devices.firmware.latest")}</Badge>}
          {release.prerelease && (
            <Badge variant="outline">{t("iot.devices.firmware.prerelease")}</Badge>
          )}
          {isInstalled && <Badge variant="outline">{t("iot.devices.firmware.installed")}</Badge>}
          <span className="text-muted-foreground ml-auto text-xs">
            {formatShortDate(release.publishedAt, locale)}
          </span>
        </div>

        {release.name !== null && <p className="text-sm">{release.name}</p>}
        {renderNotes(release)}

        <div className="flex flex-wrap items-center gap-3">
          {release.assets.map((asset) => (
            <a
              key={asset.name}
              href={asset.downloadUrl}
              className="inline-flex items-center gap-1 text-xs underline"
            >
              <Download className="h-3 w-3" aria-hidden />
              {asset.name}
              <span className="text-muted-foreground">({formatBytes(asset.sizeBytes)})</span>
            </a>
          ))}
          <a
            href={release.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground inline-flex items-center gap-1 text-xs underline"
          >
            {t("iot.devices.firmware.viewOnGitHub")}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </li>
    );
  }

  if (releases.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {t("iot.devices.firmware.noReleases")}
      </p>
    );
  }

  return <ul className="divide-y rounded-lg border">{releases.map(renderRelease)}</ul>;
}
