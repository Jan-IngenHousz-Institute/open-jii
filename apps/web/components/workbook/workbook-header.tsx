"use client";

import { AutosaveIndicator } from "@/components/shared/autosave/autosave-indicator";
import { orpcClient } from "@/lib/orpc";
import { decodeBase64 } from "@/util/base64";
import { SENSOR_FAMILY_OPTIONS } from "@/util/sensor-family";
import { ChevronDown, GitBranch, Play, Square, Trash2, Usb } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ConnectionStatusCluster } from "~/components/iot/connection-status-cluster";
import { sensorFamilyToDeviceType } from "~/hooks/iot/device-type-mapping";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";
import type { WorkbookConnectionType } from "~/hooks/iot/useIotConnections/useIotConnections";
import { mockDevicesEnabled } from "~/lib/iot/mock-devices";
import { presentDevice, resolveDevicePrimaryLabel } from "~/util/device-presentation";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { useTranslation } from "@repo/i18n";
import { getDeviceTransportSupport } from "@repo/iot";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { useIsMobile, useIsLgTablet, useIsTablet } from "@repo/ui/hooks/use-mobile";
import { cn } from "@repo/ui/lib/utils";

interface WorkbookHeaderProps {
  title: string;
  cells: WorkbookCell[];
  isConnected: boolean;
  isConnecting: boolean;
  connectedDevices: {
    id: string;
    label: string;
    family?: SensorFamily;
    name?: string;
    stableId?: string;
    ordinal?: number;
  }[];
  sensorFamily: SensorFamily;
  onSensorFamilyChange?: (family: SensorFamily) => void;
  connectionType: WorkbookConnectionType;
  onConnectionTypeChange?: (type: WorkbookConnectionType) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onDisconnectDevice?: (id: string) => void;
  isRunningAll: boolean;
  onRunAll: () => void;
  onStopExecution: () => void;
  onClearOutputs: () => void;
  isSticky?: boolean;
  flowchartOpen?: boolean;
  onToggleFlowchart?: () => void;
  readOnly?: boolean;
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Falls back to "untitled" so we never produce a dotfile.
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

function macroExtension(language: "python" | "r" | "javascript"): string {
  switch (language) {
    case "python":
      return ".py";
    case "r":
      return ".r";
    case "javascript":
      return ".js";
  }
}

export function WorkbookHeader({
  title,
  cells,
  isConnected,
  isConnecting,
  connectedDevices,
  sensorFamily,
  onSensorFamilyChange,
  connectionType,
  onConnectionTypeChange,
  onConnect,
  onDisconnect,
  onDisconnectDevice,
  isRunningAll,
  onRunAll,
  onStopExecution,
  onClearOutputs,
  flowchartOpen,
  onToggleFlowchart,
  isSticky,
  readOnly = false,
}: WorkbookHeaderProps) {
  const { t } = useTranslation("iot");
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isLgTablet = useIsLgTablet();
  const compact = isMobile || isTablet || isLgTablet;

  const browserSupport = useIotBrowserSupport(sensorFamily);
  const deviceTransportSupport = getDeviceTransportSupport(sensorFamilyToDeviceType(sensorFamily));
  const bluetoothClassicOnly =
    deviceTransportSupport.supportsBluetoothClassic && !deviceTransportSupport.supportsBLE;
  const presentedDevices = connectedDevices.map((device) => {
    const presentation = presentDevice({
      name: device.name ?? (device.family ? undefined : device.label),
      family: device.family,
      id: device.stableId,
    });
    const primary = resolveDevicePrimaryLabel(presentation, t);
    const ordinal =
      device.ordinal != null
        ? t("iot.workbookBar.deviceOrdinal", { ordinal: device.ordinal })
        : null;
    const identitySecondary =
      presentation.id ?? ordinal ?? (device.label !== primary ? device.label : null);
    const secondaryParts = [
      presentation.provenance !== "product" ? presentation.productName : null,
      identitySecondary,
    ]
      .filter((value): value is string => value != null && value !== primary)
      .filter((value, index, values) => values.indexOf(value) === index);
    const secondary = secondaryParts.length > 0 ? secondaryParts.join(" · ") : null;
    return { ...device, primary, secondary };
  });
  // Resolved after mount: depends on window.location, so rendering it on the
  // server would cause a hydration mismatch.
  const [showMockDevices, setShowMockDevices] = useState(false);
  useEffect(() => {
    setShowMockDevices(mockDevicesEnabled());
  }, []);
  const transportSupported =
    connectionType === "mock"
      ? true
      : connectionType === "serial"
        ? browserSupport.serial
        : browserSupport.bluetooth;
  const transportTooltip = transportSupported
    ? null
    : connectionType === "serial"
      ? browserSupport.serialReason === "browser"
        ? t("iot.protocolRunner.webSerialNotSupported")
        : t("iot.protocolRunner.deviceNoSerial")
      : browserSupport.bluetoothReason === "browser"
        ? t("iot.protocolRunner.webBluetoothNotSupported")
        : bluetoothClassicOnly
          ? t("iot.protocolRunner.bluetoothClassicHint")
          : t("iot.protocolRunner.deviceNoBLE");

  const handleExportJSON = useCallback(() => {
    const workbook = {
      metadata: {
        title,
        version: "1.0.0",
        created: new Date().toISOString(),
        device_family: sensorFamily,
      },
      cells: cells.map((cell) => ({
        ...cell,
        isCollapsed: false,
      })),
    };
    const json = JSON.stringify(workbook, null, 2);
    const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadFile(json, `${safeName}.jii.json`, "application/json");
  }, [title, cells, sensorFamily]);

  const handleExportProtocol = useCallback(async () => {
    const protocolCells = cells.filter((c) => c.type === "protocol");
    if (protocolCells.length === 0) return;

    for (const cell of protocolCells) {
      try {
        const { name, code } = await orpcClient.protocols.getProtocol({
          id: cell.payload.protocolId,
        });
        const filename = `${slugify(name)}.json`;
        downloadFile(JSON.stringify(code, null, 2), filename, "application/json");
      } catch {
        continue;
      }
    }
  }, [cells]);

  const handleExportMacro = useCallback(async () => {
    const macroCells = cells.filter((c) => c.type === "macro");
    if (macroCells.length === 0) return;

    // Use the macro's display name, not the stored DB filename (which can be
    // a generic placeholder like seed_macro_e5664d67...).
    for (const cell of macroCells) {
      try {
        const { name, language, code } = await orpcClient.macros.getMacro({
          id: cell.payload.macroId,
        });
        const decoded = (() => {
          try {
            return decodeBase64(code);
          } catch {
            return code;
          }
        })();
        const filename = `${slugify(name)}${macroExtension(language)}`;
        // octet-stream preserves the filename; text/plain forces .txt in some browsers.
        downloadFile(decoded, filename, "application/octet-stream");
      } catch {
        continue;
      }
    }
  }, [cells]);

  const handleDownloadWorkbook = useCallback(() => {
    const workbook = {
      metadata: {
        title,
        version: "1.0.0",
        created: new Date().toISOString(),
        device_family: sensorFamily,
      },
      cells,
    };
    const json = JSON.stringify(workbook, null, 2);
    const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadFile(json, `${safeName}.jii`, "application/json");
  }, [title, cells, sensorFamily]);

  const hasProtocols = cells.some((c) => c.type === "protocol");
  const hasMacros = cells.some((c) => c.type === "macro");
  const hasOutputs = cells.some((c) => c.type === "output");

  return (
    <div className="bg-card border-border sticky top-16 z-30 flex items-center gap-2 border-b px-4 py-2 xl:gap-3 xl:py-3">
      <div className="flex items-center gap-1.5 xl:gap-2.5">
        {onSensorFamilyChange && (
          <Select
            value={sensorFamily}
            onValueChange={(v) => {
              const family = v as SensorFamily;
              onSensorFamilyChange(family);
              if (family === "multispeq" && connectionType === "bluetooth") {
                onConnectionTypeChange?.("serial");
              }
            }}
            disabled={isConnected || isConnecting}
          >
            <SelectTrigger className="h-[34px] gap-1 border px-2.5 text-[12px] font-normal leading-[18px] xl:h-[38px] xl:gap-2 xl:px-4 xl:text-[13px] xl:leading-[21px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SENSOR_FAMILY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {onConnectionTypeChange && (
          <Select
            value={connectionType}
            onValueChange={(v) => onConnectionTypeChange(v as WorkbookConnectionType)}
            disabled={isConnecting}
          >
            <SelectTrigger className="h-[34px] gap-1 border px-2.5 text-[12px] font-normal leading-[18px] xl:h-[38px] xl:gap-2 xl:px-4 xl:text-[13px] xl:leading-[21px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="serial">{t("iot.protocolRunner.serial")}</SelectItem>
              <SelectItem value="bluetooth" disabled={sensorFamily === "multispeq"}>
                {t("iot.protocolRunner.bluetooth")}
              </SelectItem>
              {showMockDevices && <SelectItem value="mock">{t("iot.workbookBar.mock")}</SelectItem>}
            </SelectContent>
          </Select>
        )}
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={isConnected ? "secondary" : "default"}
              size="sm"
              className={cn(
                "shrink-0",
                (isConnecting || (!isConnected && !transportSupported)) &&
                  "cursor-not-allowed opacity-50",
              )}
              style={
                isConnected
                  ? { background: "var(--muted)", borderRadius: 8, color: "var(--foreground)" }
                  : {
                      background: "var(--primary)",
                      borderRadius: 8,
                      color: "var(--primary-foreground)",
                    }
              }
              onClick={onConnect}
              disabled={isConnecting || !transportSupported}
              data-testid="connect-device"
            >
              <Usb className="size-4" />
              <span className="hidden xl:inline">
                {isConnected ? t("iot.workbookBar.addDevice") : t("iot.workbookBar.connect")}
              </span>
            </Button>
          </TooltipTrigger>
          {transportTooltip && (
            <TooltipContent>
              <p>{transportTooltip}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <ConnectionStatusCluster
        isConnected={isConnected}
        isConnecting={isConnecting}
        devices={presentedDevices}
        onDisconnectDevice={onDisconnectDevice}
        onDisconnectAll={onDisconnect}
      />

      <div className="flex-1" />

      {onToggleFlowchart && (
        <Button
          type="button"
          variant="secondary"
          className={cn(
            "h-[34px] shrink-0 gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold leading-[18px] xl:h-[44px] xl:gap-2 xl:px-4 xl:text-[15px] xl:leading-[20px]",
            flowchartOpen ? "bg-secondary text-primary" : "bg-muted text-foreground",
          )}
          onClick={onToggleFlowchart}
        >
          <GitBranch className="size-4" />
          <span className="hidden xl:inline">{t("iot.workbookBar.flow")}</span>
        </Button>
      )}

      <div
        className={cn(
          "transition-opacity duration-300",
          isSticky ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <AutosaveIndicator variant={compact ? "compact" : "full"} />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-[34px] shrink-0 gap-1.5 rounded-xl px-2.5 text-[12px] font-normal leading-[18px] xl:h-[44px] xl:gap-2 xl:px-4 xl:text-[13px] xl:leading-[21px]"
          >
            <span className="hidden xl:inline">{t("iot.workbookBar.export")}</span>
            <ChevronDown className="size-3 xl:size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={handleExportJSON}>
            {t("iot.workbookBar.exportJson")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleExportProtocol()} disabled={!hasProtocols}>
            {t("iot.workbookBar.exportProtocol")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleExportMacro()} disabled={!hasMacros}>
            {t("iot.workbookBar.exportMacro")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDownloadWorkbook}>
            {t("iot.workbookBar.downloadWorkbook")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        variant="secondary"
        className={cn(
          "bg-muted text-foreground h-[34px] shrink-0 gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold leading-[18px] xl:h-[44px] xl:gap-2 xl:px-4 xl:text-[15px] xl:leading-[20px]",
          !hasOutputs && "cursor-not-allowed opacity-50",
        )}
        onClick={onClearOutputs}
        disabled={!hasOutputs}
      >
        <Trash2 className="size-4" />
        <span className="hidden xl:inline">{t("iot.workbookBar.clearAll")}</span>
      </Button>

      {/* Only the workbook creator can run cells; the backend rejects updates
          from others, so non-creators don't see the Run all / Stop control. */}
      {!readOnly &&
        (isRunningAll ? (
          <Button
            type="button"
            variant="destructive"
            className="h-[34px] shrink-0 gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold leading-[18px] xl:h-[44px] xl:gap-2 xl:px-4 xl:text-[15px] xl:leading-[20px]"
            onClick={onStopExecution}
          >
            <Square className="size-4 fill-current" />
            <span className="hidden xl:inline">{t("iot.workbookBar.stop")}</span>
          </Button>
        ) : (
          <Button
            type="button"
            className={cn(
              "h-[34px] shrink-0 gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold leading-[18px] xl:h-[44px] xl:gap-2 xl:px-4 xl:text-[15px] xl:leading-[20px]",
              cells.length === 0 && "cursor-not-allowed opacity-50",
            )}
            onClick={onRunAll}
            disabled={cells.length === 0}
          >
            <Play className="size-4 fill-current" />
            <span className="hidden xl:inline">{t("iot.workbookBar.runAll")}</span>
          </Button>
        ))}
    </div>
  );
}
