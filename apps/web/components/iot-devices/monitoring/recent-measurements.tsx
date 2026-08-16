"use client";

import { formatTimestamp } from "@/util/date";

import type { DeviceMeasurement } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

import { EntityLink } from "./entity-link";
import type { EntityAccess } from "./resolve-entity-label";
import { resolveEntities } from "./resolve-entity-label";

interface RecentMeasurementsProps {
  measurements: DeviceMeasurement[];
  visibleExperiments: EntityAccess[];
  visibleProtocols: EntityAccess[];
  locale: string;
}

/**
 * The rows behind the aggregates: what this device actually sent, newest
 * first. Identities resolve to names only for viewers who can open them.
 */
export function RecentMeasurements({
  measurements,
  visibleExperiments,
  visibleProtocols,
  locale,
}: RecentMeasurementsProps) {
  const { t } = useTranslation("iot");

  if (measurements.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {t("iot.devices.monitoring.noMeasurements")}
      </p>
    );
  }

  const experiments = resolveEntities(
    measurements.flatMap((row) => (row.experimentId === null ? [] : [row.experimentId])),
    visibleExperiments,
    (id) => `/${locale}/platform/experiments/${id}/data`,
    (index) => t("iot.devices.monitoring.privateExperiment", { index }),
  );
  const protocols = resolveEntities(
    measurements.flatMap((row) => (row.protocolId === null ? [] : [row.protocolId])),
    visibleProtocols,
    (id) => `/${locale}/platform/protocols/${id}`,
    // Protocols are not access-controlled; an unresolvable id is one the
    // platform does not define.
    () => t("iot.devices.monitoring.unknownProtocolId"),
  );

  return (
    <div className="max-h-96 overflow-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-background sticky top-0">
          <TableRow>
            <TableHead>{t("iot.devices.monitoring.measuredAt")}</TableHead>
            <TableHead>{t("iot.devices.monitoring.experiment")}</TableHead>
            <TableHead>{t("iot.devices.monitoring.protocol")}</TableHead>
            <TableHead className="text-right">{t("iot.devices.monitoring.batteryAxis")}</TableHead>
            <TableHead className="text-right">{t("iot.devices.monitoring.location")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {measurements.map((row) => (
            <TableRow key={`${row.timestamp}-${row.experimentId ?? ""}-${row.protocolId ?? ""}`}>
              <TableCell className="whitespace-nowrap text-xs tabular-nums">
                {formatTimestamp(row.timestamp, locale)}
              </TableCell>
              <TableCell className="text-xs">
                <EntityCell id={row.experimentId} resolved={experiments} />
              </TableCell>
              <TableCell className="text-xs">
                <EntityCell id={row.protocolId} resolved={protocols} />
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">
                {row.battery === null ? "-" : row.battery.toFixed(2)}
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">
                {row.latitude === null || row.longitude === null
                  ? "-"
                  : `${row.latitude.toFixed(3)}, ${row.longitude.toFixed(3)}`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EntityCell({
  id,
  resolved,
}: {
  id: string | null;
  resolved: ReturnType<typeof resolveEntities>;
}) {
  const entity = id === null ? undefined : resolved.get(id);
  if (entity === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  return <EntityLink entity={entity} />;
}
