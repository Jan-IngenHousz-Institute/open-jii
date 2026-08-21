"use client";

import { ConnectivityDot } from "@/components/iot-devices/device-connectivity";
import { IotDeviceStatusBadge } from "@/components/iot-devices/iot-device-status-badge";
import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime } from "@/util/date";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
  Cpu,
  Database,
  FlaskConical,
  HelpCircle,
  Layers,
  NotebookText,
  Radio,
  ScrollText,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import type { LineageNodeModel } from "./build-device-lineage";
import { lineageNodeTitle } from "./lineage-title";

const KIND_STYLE: Record<LineageNodeModel["kind"], { accent: string; icon: LucideIcon }> = {
  device: { accent: "#2D3142", icon: Cpu },
  broker: { accent: "#119DA4", icon: Radio },
  warehouse: { accent: "#6F8596", icon: Database },
  experiment: { accent: "#005e5e", icon: FlaskConical },
  unattributed: { accent: "#68737B", icon: HelpCircle },
  protocol: { accent: "#6C5CE7", icon: ScrollText },
  workbook: { accent: "#D08A3C", icon: NotebookText },
  macro: { accent: "#C58AAE", icon: Wand2 },
  "attribution-other": { accent: "#68737B", icon: Layers },
};

function nodeHandles(model: LineageNodeModel): { hasInput: boolean; hasOutput: boolean } {
  if (model.kind === "protocol" || model.kind === "workbook") {
    return { hasInput: false, hasOutput: true };
  }
  if (model.kind === "attribution-other") {
    // Folded macros receive from the warehouse; folded inputs feed the device.
    return model.attributionKind === "macro"
      ? { hasInput: true, hasOutput: false }
      : { hasInput: false, hasOutput: true };
  }
  if (model.kind === "device" || model.kind === "broker" || model.kind === "warehouse") {
    return { hasInput: true, hasOutput: true };
  }
  return { hasInput: true, hasOutput: false };
}

export interface LineageNodeData extends Record<string, unknown> {
  model: LineageNodeModel;
}

/**
 * One lineage stage in the flow-editor's visual language: surface card, left
 * accent bar, icon + title. Clicking selects the node for the inspect panel;
 * links deliberately live there, not in the node.
 */
export function LineageNode(props: NodeProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const model = (props.data as LineageNodeData).model;
  const style = KIND_STYLE[model.kind];
  const Icon = style.icon;

  const { hasInput, hasOutput } = nodeHandles(model);
  const title = lineageNodeTitle(model, t);

  function renderFacts() {
    if (model.kind === "device") {
      return (
        <>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-[11px]">{model.family}</span>
            <IotDeviceStatusBadge status={model.status} />
          </div>
          {model.firmwareVersion !== null && (
            <p className="text-muted-foreground text-xs">
              {t("iot.devices.lineage.firmware", { version: model.firmwareVersion })}
            </p>
          )}
        </>
      );
    }

    if (model.kind === "broker") {
      return (
        <>
          <p
            className="text-muted-foreground truncate font-mono text-[11px]"
            title={model.thingName}
          >
            {model.thingName}
          </p>
          <div className="flex items-center gap-2">
            <ConnectivityDot connectivity={model.connectivity} />
            {model.uptimePercent !== null && (
              <span className="text-muted-foreground text-xs">
                {t("iot.devices.lineage.uptime", { percent: Math.round(model.uptimePercent) })}
              </span>
            )}
          </div>
        </>
      );
    }

    if (model.kind === "warehouse") {
      return (
        <>
          <p className="text-xs">
            {t("iot.devices.lineage.measurementsInRange", { count: model.totalMeasurements })}
          </p>
          <p className="text-muted-foreground text-xs">
            {model.lastDataAt === null
              ? t("iot.devices.monitoring.noData")
              : t("iot.devices.lineage.lastData", {
                  time: formatRelativeTime(model.lastDataAt, locale),
                })}
          </p>
          <p className="text-muted-foreground text-[11px]">{t("iot.devices.lineage.stages")}</p>
        </>
      );
    }

    if (model.kind === "experiment") {
      return (
        <>
          <p className="text-xs">
            {t("iot.devices.lineage.measurementsInRange", { count: model.count })}
          </p>
          {model.count === 0 && model.bound && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {t("iot.devices.monitoring.boundButSilent")}
            </p>
          )}
          {!model.bound && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {t("iot.devices.monitoring.notBound")}
            </p>
          )}
        </>
      );
    }

    if (model.kind === "unattributed" || model.kind === "attribution-other") {
      return (
        <p className="text-muted-foreground text-xs">
          {t("iot.devices.lineage.measurementsInRange", { count: model.count })}
        </p>
      );
    }

    return (
      <p className="text-muted-foreground text-xs">
        {t(`iot.devices.lineage.${model.kind}Caption`)}
        {" · "}
        {t("iot.devices.lineage.measurementsInRange", { count: model.count })}
      </p>
    );
  }

  return (
    <div
      data-testid="lineage-node"
      className={cn(
        "bg-card relative w-[260px] overflow-hidden rounded-[12px] border shadow-sm transition-shadow",
        props.selected ? "ring-jii-dark-green border-[#005e5e] ring-2" : "border-[#E2E8F0]",
      )}
    >
      {hasInput && <Handle type="target" position={Position.Left} className="!bg-[#CDD5DB]" />}
      {hasOutput && <Handle type="source" position={Position.Right} className="!bg-[#CDD5DB]" />}
      <div
        className="absolute bottom-0 left-0 top-0 w-1"
        style={{ backgroundColor: style.accent }}
      />
      <div className="space-y-1 py-2.5 pl-4 pr-3">
        <div className="flex items-center gap-2">
          <span style={{ color: style.accent }}>
            <Icon size={16} strokeWidth={2} aria-hidden />
          </span>
          <span className="truncate text-sm font-medium" title={title}>
            {title}
          </span>
        </div>
        {renderFacts()}
      </div>
    </div>
  );
}
