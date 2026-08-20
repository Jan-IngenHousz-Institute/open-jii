"use client";

import { ROOT_CA_FILES } from "@/components/iot-devices/amazon-root-ca";
import { CredentialsShowOnceBanner } from "@/components/iot-devices/credentials-show-once-banner";
import {
  credentialBundleZipName,
  deviceCredentialFiles,
  downloadZip,
} from "@/components/iot-devices/iot-credential-file";
import { AlertTriangle, Check, Download } from "lucide-react";

import type {
  IotDeviceGroupCredentialRow,
  IotDeviceGroupRevokeRow,
} from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import type { IssueIotCredentialsResponse } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

/** One finished batch; revocation delivers nothing, so its rows stay bare. */
export type GroupCredentialBatch =
  | { action: "issue" | "rotate"; rows: IotDeviceGroupCredentialRow[] }
  | { action: "revoke"; rows: IotDeviceGroupRevokeRow[] };

interface GroupCredentialResultsProps {
  groupName: string;
  batch: GroupCredentialBatch;
  labelByDeviceId: Map<string, string>;
}

interface IssuedBundle {
  thingName: string;
  credentials: IssueIotCredentialsResponse;
}

// Group names are free text; keep the archive name filesystem-safe.
function zipFileName(groupName: string): string {
  const safe = groupName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe === "" ? "group" : safe}-credentials.zip`;
}

/**
 * Per-device outcomes plus delivery: each issued certificate as its own
 * bundle, and the whole batch as one zip with per-device folders and a
 * manifest. Keys exist only in this response, so delivery is the last chance.
 */
export function GroupCredentialResults({
  groupName,
  batch,
  labelByDeviceId,
}: GroupCredentialResultsProps) {
  const { t } = useTranslation("iot");

  const issued: IssuedBundle[] =
    batch.action === "revoke"
      ? []
      : batch.rows.flatMap((row) =>
          row.credentials !== null && row.thingName !== null
            ? [{ thingName: row.thingName, credentials: row.credentials }]
            : [],
        );

  function downloadOne(bundle: IssuedBundle) {
    downloadZip(credentialBundleZipName(bundle.thingName), [
      ...deviceCredentialFiles(bundle.thingName, bundle.credentials),
      ...ROOT_CA_FILES,
    ]);
  }

  function downloadAll() {
    // One folder per device; the root CAs and manifest sit at the archive root.
    const files = issued.flatMap((bundle) =>
      deviceCredentialFiles(bundle.thingName, bundle.credentials).map((file) => ({
        ...file,
        filename: `${bundle.thingName}/${file.filename}`,
      })),
    );
    files.push(...ROOT_CA_FILES, {
      filename: "manifest.json",
      content: JSON.stringify(
        {
          group: groupName,
          action: batch.action,
          devices: issued.map((bundle) => bundle.thingName),
        },
        null,
        2,
      ),
    });
    downloadZip(zipFileName(groupName), files);
  }

  function renderCredentialRow(row: IotDeviceGroupCredentialRow) {
    const label = labelByDeviceId.get(row.deviceId) ?? row.deviceId;
    const deliverable = row.credentials !== null && row.thingName !== null;

    return (
      <li key={row.deviceId} className="flex items-center gap-2 py-1.5 text-sm">
        {row.error === null ? (
          <Check className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {row.error !== null && <span className="text-muted-foreground text-xs">{row.error}</span>}
        {deliverable && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("iot.groups.credentials.downloadOne", { device: label })}
            onClick={() => {
              if (row.credentials !== null && row.thingName !== null) {
                downloadOne({ thingName: row.thingName, credentials: row.credentials });
              }
            }}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
          </Button>
        )}
      </li>
    );
  }

  function renderRevokeRow(row: IotDeviceGroupRevokeRow) {
    const label = labelByDeviceId.get(row.deviceId) ?? row.deviceId;

    return (
      <li key={row.deviceId} className="flex items-center gap-2 py-1.5 text-sm">
        {row.error === null ? (
          <Check className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {row.error !== null && <span className="text-muted-foreground text-xs">{row.error}</span>}
      </li>
    );
  }

  return (
    <div className="space-y-3">
      {issued.length > 0 && <CredentialsShowOnceBanner />}

      <ul className="divide-y rounded-lg border px-3">
        {batch.action === "revoke"
          ? batch.rows.map(renderRevokeRow)
          : batch.rows.map(renderCredentialRow)}
      </ul>

      {issued.length > 0 && (
        <Button onClick={downloadAll}>
          <Download className="mr-2 h-4 w-4" aria-hidden />
          {t("iot.groups.credentials.downloadAll", { count: issued.length })}
        </Button>
      )}
    </div>
  );
}
