"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatShortDate } from "@/util/date";
import { isSameFirmwareVersion } from "@/util/firmware-family";
import { formatFileSize } from "@/util/format-file-size";
import { ChevronDown, Download, ExternalLink } from "lucide-react";

import type { FirmwareRelease } from "@repo/api/domains/iot/firmware/iot-firmware.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { EmptyState } from "@repo/ui/components/empty-state";

import { FirmwareReleaseNotes } from "./firmware-release-notes";

/**
 * A tag that IS a version (v1.10.1, 2.0, v1.4.0-rc1). Firmware repositories
 * also release tooling under name-prefixed tags (flash-gui-v0.2.8); those are
 * not images a device can run, so they fold behind a toggle instead of
 * drowning the line a rollout actually installs from.
 */
const FIRMWARE_TAG = /^v?\d+(\.\d+)+/;

interface FirmwareReleaseListProps {
  releases: FirmwareRelease[];
  /** Version the device last reported, so its own release is marked. */
  installedVersion: string | null;
}

export function FirmwareReleaseList({ releases, installedVersion }: FirmwareReleaseListProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  function renderAssetChip(asset: FirmwareRelease["assets"][number]) {
    return (
      <a
        key={asset.name}
        href={asset.downloadUrl}
        className="bg-muted hover:bg-muted/70 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors"
      >
        <Download className="size-3 shrink-0" aria-hidden />
        <span className="max-w-48 truncate">{asset.name}</span>
        <span className="text-muted-foreground font-normal">{formatFileSize(asset.sizeBytes)}</span>
      </a>
    );
  }

  function renderRelease(release: FirmwareRelease) {
    const isInstalled =
      installedVersion !== null && isSameFirmwareVersion(installedVersion, release.version);

    return (
      <li key={release.version} className="space-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{release.version}</span>
          {release.latest && <Badge variant="secondary">{t("iot.devices.firmware.latest")}</Badge>}
          {release.prerelease && (
            <Badge variant="outline">{t("iot.devices.firmware.prerelease")}</Badge>
          )}
          {isInstalled && <Badge variant="outline">{t("iot.devices.firmware.installed")}</Badge>}
          <span className="text-muted-foreground ml-auto text-xs">
            {formatShortDate(release.publishedAt, locale)}
          </span>
        </div>

        {release.name !== null && release.name !== release.version && (
          <p className="text-sm">{release.name}</p>
        )}
        <FirmwareReleaseNotes notesHtml={release.notesHtml} />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {release.assets.map(renderAssetChip)}
          <a
            href={release.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-1 text-xs"
          >
            {t("iot.devices.firmware.viewOnGitHub")}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </li>
    );
  }

  if (releases.length === 0) {
    return <EmptyState size="inline" description={t("iot.devices.firmware.noReleases")} />;
  }

  const firmware = releases.filter((release) => FIRMWARE_TAG.test(release.version));
  const tooling = releases.filter((release) => !FIRMWARE_TAG.test(release.version));

  // A repository publishing only prefixed tags is not hiding firmware behind
  // a toggle; the split only applies when both kinds exist.
  if (firmware.length === 0 || tooling.length === 0) {
    return <ul className="divide-y rounded-lg border">{releases.map(renderRelease)}</ul>;
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-lg border">{firmware.map(renderRelease)}</ul>

      <Collapsible>
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs">
          {t("iot.devices.firmware.toolingReleases", { count: tooling.length })}
          <ChevronDown className="size-3" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mt-2 divide-y rounded-lg border">{tooling.map(renderRelease)}</ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
