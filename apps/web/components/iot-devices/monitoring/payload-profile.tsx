"use client";

import type { DevicePayloadStats } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Progress } from "@repo/ui/components/progress";

import { EntityLink } from "./entity-link";
import { MONITORING_SERIES_COLORS } from "./monitoring-palette";
import type { EntityAccess } from "./resolve-entity-label";
import { resolveEntities } from "./resolve-entity-label";

interface PayloadProfileProps {
  payload: DevicePayloadStats;
  /** Entities the viewer may open; anything else stays unnamed. */
  visibleProtocols: EntityAccess[];
  visibleWorkbooks: EntityAccess[];
  locale: string;
}

/**
 * What the device's payloads carried: how often the optional channels were
 * populated, and which firmware, protocols and workbooks produced the
 * measurements. Every referenced entity resolves to a name and a link when the
 * viewer can open it.
 */
export function PayloadProfile({
  payload,
  visibleProtocols,
  visibleWorkbooks,
  locale,
}: PayloadProfileProps) {
  const { t } = useTranslation("iot");
  const total = payload.totalMeasurements;

  if (total === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {t("iot.devices.monitoring.noMeasurements")}
      </p>
    );
  }

  const protocolEntities = resolveEntities(
    payload.protocolMix.flatMap((entry) => (entry.protocolId === null ? [] : [entry.protocolId])),
    visibleProtocols,
    (id) => `/${locale}/platform/protocols/${id}`,
    (index) => t("iot.devices.monitoring.privateProtocol", { index }),
  );
  const workbookEntities = resolveEntities(
    payload.workbookMix.flatMap((entry) =>
      entry.workbookVersionId === null ? [] : [entry.workbookVersionId],
    ),
    visibleWorkbooks,
    (id) => `/${locale}/platform/workbooks/${id}`,
    (index) => t("iot.devices.monitoring.privateWorkbook", { index }),
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-medium">{t("iot.devices.monitoring.coverage")}</p>
          <CoverageMeter
            label={t("iot.devices.monitoring.gpsCoverage")}
            covered={payload.withGps}
            total={total}
          />
          <CoverageMeter
            label={t("iot.devices.monitoring.batteryCoverage")}
            covered={payload.withBattery}
            total={total}
          />
        </div>

        <dl className="grid grid-cols-2 gap-3 self-start">
          <Figure label={t("iot.devices.monitoring.measurements")} value={total} />
          <Figure label={t("iot.devices.monitoring.workbookRuns")} value={payload.workbookRuns} />
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Breakdown
          title={t("iot.devices.monitoring.firmwareVersions")}
          hint={t("iot.devices.monitoring.asReported")}
          total={total}
          rows={payload.firmwareMix.map((entry) => ({
            key: entry.version ?? "unknown",
            count: entry.count,
            node: (
              <span className="font-mono">
                {entry.version ?? t("iot.devices.monitoring.unknownVersion")}
              </span>
            ),
          }))}
        />

        <Breakdown
          title={t("iot.devices.monitoring.protocols")}
          hint={t("iot.devices.monitoring.protocolLegacyHint")}
          total={payload.protocolMix.reduce((sum, entry) => sum + entry.count, 0)}
          rows={payload.protocolMix.map((entry) => ({
            key: entry.protocolId ?? "unknown",
            count: entry.count,
            node:
              entry.protocolId === null ? (
                <span className="text-muted-foreground italic">
                  {t("iot.devices.monitoring.unknownProtocol")}
                </span>
              ) : (
                <EntityLink
                  entity={
                    protocolEntities.get(entry.protocolId) ?? {
                      id: entry.protocolId,
                      label: t("iot.devices.monitoring.unknownProtocol"),
                      href: null,
                      accessible: false,
                    }
                  }
                />
              ),
          }))}
        />

        <Breakdown
          title={t("iot.devices.monitoring.workbooks")}
          total={total}
          rows={payload.workbookMix.map((entry) => ({
            key: entry.workbookVersionId ?? "none",
            count: entry.count,
            node:
              entry.workbookVersionId === null ? (
                <span className="text-muted-foreground italic">
                  {t("iot.devices.monitoring.noWorkbook")}
                </span>
              ) : (
                <EntityLink
                  entity={
                    workbookEntities.get(entry.workbookVersionId) ?? {
                      id: entry.workbookVersionId,
                      label: t("iot.devices.monitoring.unknownWorkbook"),
                      href: null,
                      accessible: false,
                    }
                  }
                />
              ),
          }))}
        />
      </div>
    </div>
  );
}

interface BreakdownRow {
  key: string;
  count: number;
  node: React.ReactNode;
}

function Breakdown({
  title,
  hint,
  rows,
  total,
}: {
  title: string;
  hint?: string;
  rows: BreakdownRow[];
  total: number;
}) {
  const { t } = useTranslation("iot");

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium">{title}</p>
        {hint !== undefined && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
      {rows.length === 0 || total === 0 ? (
        <p className="text-muted-foreground text-xs">{t("iot.devices.monitoring.noBreakdown")}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row, index) => (
            <li key={row.key} className="space-y-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{row.node}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {`${((row.count / total) * 100).toFixed(0)}%`}
                </span>
              </div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${String((row.count / total) * 100)}%`,
                    backgroundColor:
                      MONITORING_SERIES_COLORS[index % MONITORING_SERIES_COLORS.length],
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CoverageMeter({
  label,
  covered,
  total,
}: {
  label: string;
  covered: number;
  total: number;
}) {
  const percent = (covered / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {`${percent.toFixed(0)}% (${String(covered)}/${String(total)})`}
        </span>
      </div>
      <Progress value={percent} className="h-1.5" />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-lg font-medium tabular-nums">{value}</dd>
    </div>
  );
}
