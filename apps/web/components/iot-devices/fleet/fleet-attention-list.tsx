"use client";

import { useLocale } from "@/hooks/useLocale";
import { CheckCircle2 } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { EmptyState } from "@repo/ui/components/empty-state";

import { DeviceRow } from "../device-row";
import type { FleetAttentionEntry, FleetAttentionReason } from "./fleet-health";

/** Enough to act on at a glance; the registry table below holds the rest. */
const VISIBLE_LIMIT = 6;

const REASON_KEY: Record<FleetAttentionReason, string> = {
  credentials: "iot.devices.fleet.reasonCredentials",
  neverConnected: "iot.devices.fleet.reasonNeverConnected",
  silent: "iot.devices.fleet.reasonSilent",
};

/** The tab where each reason is acted on. */
const REASON_SEGMENT: Record<FleetAttentionReason, string> = {
  credentials: "/credentials",
  neverConnected: "",
  silent: "/monitoring",
};

interface FleetAttentionListProps {
  entries: FleetAttentionEntry[];
}

export function FleetAttentionList({ entries }: FleetAttentionListProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  if (entries.length === 0) {
    return (
      <EmptyState
        size="inline"
        icon={<CheckCircle2 aria-hidden />}
        description={t("iot.devices.fleet.attentionEmpty")}
      />
    );
  }

  function renderEntry(entry: FleetAttentionEntry) {
    return (
      <li key={entry.device.id}>
        <DeviceRow
          device={entry.device}
          href={`/${locale}/platform/devices/${entry.device.id}${REASON_SEGMENT[entry.reason]}`}
          hideFamily
          trailing={
            <Badge variant="outline" className="text-muted-foreground font-normal">
              {t(REASON_KEY[entry.reason])}
            </Badge>
          }
        />
      </li>
    );
  }

  const visible = entries.slice(0, VISIBLE_LIMIT);

  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-lg border">{visible.map(renderEntry)}</ul>
      {entries.length > VISIBLE_LIMIT && (
        <p className="text-muted-foreground text-xs">
          {t("iot.devices.fleet.attentionMore", { count: entries.length - VISIBLE_LIMIT })}
        </p>
      )}
    </div>
  );
}
