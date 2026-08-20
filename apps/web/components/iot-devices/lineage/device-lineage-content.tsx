"use client";

import type { LineageNodeModel } from "@/components/iot-devices/lineage/build-device-lineage";
import { buildDeviceLineage } from "@/components/iot-devices/lineage/build-device-lineage";
import { DeviceLineageFlow } from "@/components/iot-devices/lineage/device-lineage-flow";
import { LineageInspectPanel } from "@/components/iot-devices/lineage/lineage-inspect-panel";
import { LineageLegend } from "@/components/iot-devices/lineage/lineage-legend";
import type {
  MonitoringPresetId,
  MonitoringRange,
} from "@/components/iot-devices/monitoring/monitoring-range";
import { resolveMonitoringPreset } from "@/components/iot-devices/monitoring/monitoring-range";
import { MonitoringRangeControl } from "@/components/iot-devices/monitoring/monitoring-range-control";
import { useDeviceExperiments } from "@/hooks/iot/useDeviceExperiments/useDeviceExperiments";
import { useDeviceMonitoring } from "@/hooks/iot/useDeviceMonitoring/useDeviceMonitoring";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { useIotDeviceActivity } from "@/hooks/iot/useIotDeviceActivity/useIotDeviceActivity";
import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { presentDevice, resolveDevicePrimaryLabel } from "@/util/device-presentation";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

const DEFAULT_PRESET: MonitoringPresetId = "last30d";

interface RangeSelection {
  range: MonitoringRange;
  preset: MonitoringPresetId | null;
}

/**
 * The identity chain as a canvas: device -> broker -> warehouse -> experiments,
 * with the range-scoped attribution fan-out. Selection drives the inspect
 * panel; the graph itself never navigates.
 */
export default function DeviceLineagePage() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const params = useParams<{ deviceId: string }>();
  const deviceId = params.deviceId;

  const [selection, setSelection] = useState<RangeSelection>(() => ({
    range: resolveMonitoringPreset(DEFAULT_PRESET),
    preset: DEFAULT_PRESET,
  }));
  const [selected, setSelected] = useState<LineageNodeModel | null>(null);

  const { data: device } = useIotDevice(deviceId);
  const { data: activity } = useIotDeviceActivity(deviceId);
  const { data: boundExperiments } = useDeviceExperiments(deviceId);
  // Names for entities the viewer can open; ids outside these lists stay
  // opaque, since a device publishing under an id says nothing about the
  // viewer's access to it.
  const { data: visibleExperiments } = useQuery(
    orpc.experiments.listExperiments.queryOptions({ input: { filter: "member" } }),
  );
  const { data: visibleProtocols } = useQuery(
    orpc.protocols.listProtocols.queryOptions({ input: {} }),
  );
  const { data: visibleWorkbooks } = useQuery(
    orpc.workbooks.listWorkbooks.queryOptions({ input: {} }),
  );
  const { data: visibleMacros } = useQuery(orpc.macros.listMacros.queryOptions({ input: {} }));
  const {
    data: monitoring,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useDeviceMonitoring(deviceId, selection.range);

  const handleRangeChange = (range: MonitoringRange, preset: MonitoringPresetId | null) => {
    setSelection({ range, preset });
    setSelected(null);
  };

  const model = useMemo(() => {
    if (device === undefined || monitoring === undefined) {
      return null;
    }
    return buildDeviceLineage({
      device,
      deviceLabel: resolveDevicePrimaryLabel(
        presentDevice({ name: device.name, family: device.deviceType, id: device.serialNumber }),
        t,
      ),
      monitoring,
      lastDataAt: activity?.lastDataAt ?? null,
      boundExperiments: boundExperiments ?? [],
      visibleExperiments: visibleExperiments ?? [],
      visibleProtocols: visibleProtocols ?? [],
      visibleWorkbooks: visibleWorkbooks ?? [],
      visibleMacros: visibleMacros ?? [],
      locale,
      labels: {
        privateExperiment: (index) => t("iot.devices.monitoring.privateExperiment", { index }),
        privateProtocol: () => t("iot.devices.monitoring.unknownProtocolId"),
        privateWorkbook: () => t("iot.devices.monitoring.unknownWorkbookId"),
        privateMacro: () => t("iot.devices.monitoring.unknownMacroId"),
      },
    });
  }, [
    device,
    monitoring,
    activity,
    boundExperiments,
    visibleExperiments,
    visibleProtocols,
    visibleWorkbooks,
    visibleMacros,
    locale,
    t,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">{t("iot.devices.lineage.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("iot.devices.lineage.description")}</p>
        </div>
        <MonitoringRangeControl
          range={selection.range}
          activePreset={selection.preset}
          onRangeChange={handleRangeChange}
          isUpdating={isFetching && !isLoading}
        />
      </div>

      {isError ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <p className="text-muted-foreground text-sm">{t("iot.devices.monitoring.loadError")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetch();
              }}
            >
              {t("iot.devices.monitoring.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : model === null || device === undefined || monitoring === undefined ? (
        <div className="space-y-6">
          <Skeleton className="h-135 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-3">
            <DeviceLineageFlow
              model={model}
              selectedNodeId={selected?.id ?? null}
              onSelect={setSelected}
            />
            <LineageLegend />
          </div>
          <LineageInspectPanel selected={selected} device={device} monitoring={monitoring} />
        </div>
      )}
    </div>
  );
}
