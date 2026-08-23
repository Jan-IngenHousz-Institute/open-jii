"use client";

import type { DevicePayloadStats } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Progress } from "@repo/ui/components/progress";

import { EntityLink } from "./entity-link";
import { MONITORING_SERIES_COLORS } from "./monitoring-palette";
import type { EntityAccess, ResolvedEntity } from "./resolve-entity-label";
import { resolveEntities } from "./resolve-entity-label";

interface PayloadProfileProps {
  payload: DevicePayloadStats;
  /** Entities the viewer may open; the rest are simply not defined here. */
  visibleProtocols: EntityAccess[];
  visibleWorkbooks: EntityAccess[];
  visibleMacros: EntityAccess[];
  locale: string;
}

/** What the payloads carried: counts, coverage, and the producing entities. */
export function PayloadProfile({
  payload,
  visibleProtocols,
  visibleWorkbooks,
  visibleMacros,
  locale,
}: PayloadProfileProps) {
  const { t } = useTranslation("iot");
  const total = payload.totalMeasurements;

  if (total === 0) {
    return <EmptyState size="inline" description={t("iot.devices.monitoring.noMeasurements")} />;
  }

  // An id the platform cannot resolve belongs to nothing it knows: unknown,
  // not withheld.
  const protocolEntities = resolveEntities(
    payload.protocolMix.flatMap((entry) => (entry.protocolId === null ? [] : [entry.protocolId])),
    visibleProtocols,
    (id) => `/${locale}/platform/protocols/${id}`,
    () => t("iot.devices.monitoring.unknownProtocolId"),
  );
  const workbookEntities = resolveEntities(
    payload.workbookMix.flatMap((entry) =>
      entry.workbookVersionId === null ? [] : [entry.workbookVersionId],
    ),
    visibleWorkbooks,
    (id) => `/${locale}/platform/workbooks/${id}`,
    () => t("iot.devices.monitoring.unknownWorkbookId"),
  );

  const macroEntities = resolveEntities(
    payload.macroMix.flatMap((entry) => (entry.macroId === null ? [] : [entry.macroId])),
    visibleMacros,
    (id) => `/${locale}/platform/macros/${id}`,
    () => t("iot.devices.monitoring.unknownMacroId"),
  );

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Figure label={t("iot.devices.monitoring.measurements")} value={String(total)} />
        <Figure
          label={t("iot.devices.monitoring.workbookRuns")}
          value={String(payload.workbookRuns)}
        />
        <Coverage
          label={t("iot.devices.monitoring.gpsCoverage")}
          covered={payload.withGps}
          total={total}
        />
        <Coverage
          label={t("iot.devices.monitoring.batteryCoverage")}
          covered={payload.withBattery}
          total={total}
        />
      </dl>

      <div className="grid gap-6 border-t pt-6 sm:grid-cols-2 lg:grid-cols-4">
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
            node: (
              <UnresolvedAware
                id={entry.protocolId}
                resolved={protocolEntities}
                fallback={t("iot.devices.monitoring.unknownProtocolId")}
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
                <UnresolvedAware
                  id={entry.workbookVersionId}
                  resolved={workbookEntities}
                  fallback={t("iot.devices.monitoring.unknownWorkbookId")}
                />
              ),
          }))}
        />

        <Breakdown
          title={t("iot.devices.monitoring.macros")}
          hint={t("iot.devices.monitoring.macroRunHint")}
          total={payload.macroMix.reduce((sum, entry) => sum + entry.count, 0)}
          rows={payload.macroMix.map((entry) => ({
            key: entry.macroId ?? "unknown",
            count: entry.count,
            node: (
              <UnresolvedAware
                id={entry.macroId}
                resolved={macroEntities}
                fallback={t("iot.devices.monitoring.unknownMacroId")}
              />
            ),
          }))}
        />
      </div>
    </div>
  );
}

/** Resolved entities link; unresolved ids name what they are and show the id. */
function UnresolvedAware({
  id,
  resolved,
  fallback,
}: {
  id: string | null;
  resolved: Map<string, ResolvedEntity>;
  fallback: string;
}) {
  const entity = id === null ? undefined : resolved.get(id);
  if (!entity?.accessible) {
    return (
      <span className="text-muted-foreground">
        {fallback}
        {id !== null && <span className="ml-1 font-mono text-[11px]">{id}</span>}
      </span>
    );
  }

  return <EntityLink entity={entity} />;
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
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium">{title}</p>
        {hint !== undefined && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
      {rows.length === 0 || total === 0 ? (
        <p className="text-muted-foreground text-xs">{t("iot.devices.monitoring.noBreakdown")}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={row.key} className="space-y-1 text-xs">
              <div className="flex items-baseline justify-between gap-2">
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

function Coverage({ label, covered, total }: { label: string; covered: number; total: number }) {
  const percent = (covered / total) * 100;

  return (
    <div className="space-y-1.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="space-y-1.5">
        <span className="block text-2xl font-semibold tabular-nums">{`${percent.toFixed(0)}%`}</span>
        <Progress value={percent} className="h-1.5" />
        <span className="text-muted-foreground block text-xs tabular-nums">
          {`${String(covered)} / ${String(total)}`}
        </span>
      </dd>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
