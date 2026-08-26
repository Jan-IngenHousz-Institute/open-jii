"use client";

import { ChevronDown, Circle } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";

export interface ClusterDevice {
  id: string;
  primary: string;
  secondary?: string | null;
}

interface ConnectionStatusClusterProps {
  isConnected: boolean;
  isConnecting: boolean;
  devices: ClusterDevice[];
  onDisconnectDevice?: (id: string) => void;
  onDisconnectAll: () => void;
}

/**
 * The compact half of the connection language: a status dot that never lies
 * (green connected, amber pulse connecting, grey off) and one trigger for the
 * connected devices, each with its own disconnect. Shared so the workbook bar
 * and any future multi-device surface state a connection the same way.
 */
export function ConnectionStatusCluster({
  isConnected,
  isConnecting,
  devices,
  onDisconnectDevice,
  onDisconnectAll,
}: ConnectionStatusClusterProps) {
  const { t } = useTranslation("iot");

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Circle
        className={cn(
          "size-2 shrink-0",
          isConnected
            ? "fill-status-active-foreground text-status-active-foreground"
            : isConnecting
              ? "fill-status-stale-foreground text-status-stale-foreground animate-pulse"
              : "fill-border text-border",
        )}
      />
      {isConnected ? (
        // One compact trigger regardless of device count; the dropdown lists
        // every connected device with per-device disconnect.
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="text-muted-foreground hover:text-foreground flex min-w-0 items-center gap-1 text-[12px] leading-[18px] xl:text-[13px] xl:leading-[21px]"
              data-testid="device-menu-trigger"
            >
              <span className="truncate">
                {devices.length > 1
                  ? t("iot.workbookBar.deviceCount", { count: devices.length })
                  : (devices[0]?.primary ?? t("iot.protocolRunner.connected"))}
              </span>
              {devices.length === 1 && devices[0]?.secondary && (
                <span className="text-muted-foreground hidden truncate text-[11px] xl:inline">
                  · {devices[0].secondary}
                </span>
              )}
              <ChevronDown className="size-3 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {devices.map((device) => (
              <DropdownMenuItem
                key={device.id}
                data-testid="device-menu-item"
                aria-label={t("iot.workbookBar.disconnectDevice", { name: device.primary })}
                className="flex items-center justify-between gap-4"
                onSelect={() => onDisconnectDevice?.(device.id)}
              >
                <span className="flex flex-col">
                  <span>{device.primary}</span>
                  {device.secondary && device.secondary !== device.primary && (
                    <span className="text-muted-foreground text-[10px]">{device.secondary}</span>
                  )}
                </span>
                <span className="text-muted-foreground text-[11px]">
                  {t("iot.protocolRunner.disconnect")}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="disconnect-all" onSelect={onDisconnectAll}>
              {t("iot.workbookBar.disconnectAll")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="text-muted-foreground hidden text-[12px] leading-[18px] xl:inline xl:text-[13px] xl:leading-[21px]">
          {isConnecting ? t("iot.protocolRunner.connecting") : t("iot.workbookBar.disconnected")}
        </span>
      )}
    </div>
  );
}
