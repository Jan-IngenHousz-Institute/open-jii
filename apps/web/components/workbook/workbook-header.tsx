"use client";

import { useWorkbookSaveStatus } from "@/components/workbook-overview/workbook-save-context";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Code,
  Download,
  File,
  FileCode,
  FileJson,
  GitBranch,
  Loader2,
  Play,
  Square,
  Trash2,
  Usb,
} from "lucide-react";
import { useCallback } from "react";

import type { SensorFamily, WorkbookCell } from "@repo/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";
import { useIsMobile, useIsTablet, useIsLgTablet } from "@repo/ui/hooks";
import { cn } from "@repo/ui/lib/utils";

interface DeviceInfo {
  device_name?: string;
  device_battery?: number;
  device_version?: string;
  device_id?: string;
}

interface WorkbookHeaderProps {
  title: string;
  cells: WorkbookCell[];
  // Device connection
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  deviceInfo: DeviceInfo | null;
  sensorFamily: SensorFamily;
  onSensorFamilyChange?: (family: SensorFamily) => void;
  connectionType: "bluetooth" | "serial";
  onConnectionTypeChange?: (type: "bluetooth" | "serial") => void;
  onConnect: () => void;
  onDisconnect: () => void;
  // Execution
  isRunningAll: boolean;
  onRunAll: () => void;
  onStopExecution: () => void;
  onClearOutputs: () => void;
  // Sticky state
  isSticky?: boolean;
  // Flowchart
  flowchartOpen?: boolean;
  onToggleFlowchart?: () => void;
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

export function WorkbookHeader({
  title,
  cells,
  isConnected,
  isConnecting,
  connectionError,
  deviceInfo,
  sensorFamily,
  onSensorFamilyChange,
  connectionType,
  onConnectionTypeChange,
  onConnect,
  onDisconnect,
  isRunningAll,
  onRunAll,
  onStopExecution,
  onClearOutputs,
  flowchartOpen,
  onToggleFlowchart,
  isSticky,
}: WorkbookHeaderProps) {
  const { isSaving, isDirty } = useWorkbookSaveStatus();
  const showSaving = isSaving || isDirty;
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isLgTablet = useIsLgTablet();
  const compact = isMobile || isTablet || isLgTablet;

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

  const handleExportProtocol = useCallback(() => {
    const protocols = cells.filter((c) => c.type === "protocol");
    if (protocols.length === 0) return;

    const protocolsJson = protocols.map((p) => {
      return { ref: p.payload.protocolId, version: p.payload.version };
    });

    const json = JSON.stringify(
      protocolsJson.length === 1 ? protocolsJson[0] : protocolsJson,
      null,
      2,
    );
    const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadFile(json, `${safeName}-protocol.json`, "application/json");
  }, [title, cells]);

  const handleExportMacro = useCallback(() => {
    // Macros are now persisted entities - export as reference list
    const macros = cells.filter((c) => c.type === "macro");
    if (macros.length === 0) return;

    const macroRefs = macros.map((m) => ({
      macroId: m.payload.macroId,
      name: m.payload.name,
      language: m.payload.language,
    }));

    const json = JSON.stringify(macroRefs, null, 2);
    const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadFile(json, `${safeName}-macros.json`, "application/json");
  }, [title, cells]);

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

  return (
    <div
      className="sticky top-16 z-30 flex items-center gap-2 rounded-b-xl border-b px-4 py-2 xl:gap-3 xl:py-3"
      style={{ background: "#FFFFFF", borderColor: "#EDF2F6" }}
    >
      {/* Device selectors */}
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
            <SelectTrigger
              className="h-[34px] gap-1 border px-2.5 text-[12px] font-normal leading-[18px] xl:h-[38px] xl:gap-2 xl:px-4 xl:text-[13px] xl:leading-[21px]"
              style={{ borderColor: "#CDD5DB", borderRadius: 12, color: "#011111" }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multispeq">MultispeQ</SelectItem>
              <SelectItem value="ambit">Ambit</SelectItem>
              <SelectItem value="generic">Generic</SelectItem>
            </SelectContent>
          </Select>
        )}

        {onConnectionTypeChange && (
          <Select
            value={connectionType}
            onValueChange={(v) => onConnectionTypeChange(v as "bluetooth" | "serial")}
            disabled={isConnected || isConnecting}
          >
            <SelectTrigger
              className="h-[34px] gap-1 border px-2.5 text-[12px] font-normal leading-[18px] xl:h-[38px] xl:gap-2 xl:px-4 xl:text-[13px] xl:leading-[21px]"
              style={{ borderColor: "#CDD5DB", borderRadius: 12, color: "#011111" }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="serial">Serial</SelectItem>
              <SelectItem value="bluetooth" disabled={sensorFamily === "multispeq"}>
                Bluetooth
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Connect button - before status */}
      <button
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-1.5 text-[12px] font-semibold leading-[18px]",
          "h-[34px] px-2.5 xl:h-[38px] xl:gap-2 xl:px-3 xl:text-[13px]",
          isConnecting && "cursor-not-allowed opacity-50",
        )}
        style={
          isConnected
            ? { background: "#EDF2F6", borderRadius: 8, color: "#011111" }
            : { background: "#005E5E", borderRadius: 8, color: "#FFFFFF" }
        }
        onClick={isConnected ? onDisconnect : onConnect}
        disabled={isConnecting}
      >
        <Usb className="size-4" />
        <span className="hidden xl:inline">{isConnected ? "Disconnect" : "Connect"}</span>
      </button>

      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        <Circle
          className={cn(
            "size-2",
            isConnected
              ? "fill-emerald-500 text-emerald-500"
              : isConnecting
                ? "animate-pulse fill-amber-400 text-amber-400"
                : "fill-gray-300 text-gray-300",
          )}
        />
        <span className="hidden text-[12px] leading-[18px] text-[#68737B] xl:inline xl:text-[13px] xl:leading-[21px]">
          {isConnecting
            ? "Connecting..."
            : isConnected
              ? (deviceInfo?.device_name ?? "Connected")
              : "Disconnected"}
        </span>
      </div>

      {isConnected && deviceInfo?.device_version && (
        <span className="hidden text-[13px] leading-[21px] text-[#68737B] xl:inline">
          FW {deviceInfo.device_version}
        </span>
      )}

      {connectionError && (
        <span
          className="text-destructive hidden max-w-48 truncate text-xs xl:inline"
          title={connectionError}
        >
          {connectionError}
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      {onToggleFlowchart && (
        <button
          className="inline-flex h-[34px] shrink-0 items-center justify-center gap-1.5 px-2.5 text-[12px] font-semibold leading-[18px] xl:h-[44px] xl:gap-2 xl:px-4 xl:text-[15px] xl:leading-[20px]"
          style={
            flowchartOpen
              ? { background: "#005E5E", borderRadius: 8, color: "#FFFFFF" }
              : { background: "#EDF2F6", borderRadius: 8, color: "#011111" }
          }
          onClick={onToggleFlowchart}
        >
          <GitBranch className="size-4" />
          <span className="hidden xl:inline">Flow</span>
        </button>
      )}

      {/* Save status indicator - only visible in sticky mode */}
      <div
        className={cn(
          "flex items-center gap-1.5 transition-opacity duration-300",
          isSticky ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {showSaving ? (
          <Loader2 className="size-4 animate-spin" style={{ color: "#68737B" }} />
        ) : (
          <CheckCircle2 className="size-4 text-emerald-500" />
        )}
        {!compact && (
          <span className="text-[13px]" style={{ color: "#68737B" }}>
            {showSaving ? "Saving..." : "Saved"}
          </span>
        )}
      </div>

      {/* Export dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="inline-flex h-[34px] shrink-0 items-center justify-center gap-1.5 border px-2.5 text-[12px] font-normal leading-[18px] xl:h-[38px] xl:gap-2 xl:px-4 xl:text-[13px] xl:leading-[21px]"
            style={{
              borderColor: "#CDD5DB",
              borderRadius: 12,
              color: "#011111",
              background: "#FFFFFF",
            }}
          >
            <Download className="size-4" />
            <span className="hidden xl:inline">Export</span>
            <ChevronDown className="size-3 xl:size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={handleExportJSON} className="gap-2">
            <FileJson className="size-4 text-blue-600" />
            Export as JSON
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleExportProtocol}
            className="gap-2"
            disabled={!hasProtocols}
          >
            <FileCode className="size-4 text-emerald-600" />
            Export Protocol Only
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportMacro} className="gap-2" disabled={!hasMacros}>
            <Code className="size-4 text-violet-600" />
            Export Macro Only
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDownloadWorkbook} className="gap-2">
            <File className="size-4 text-amber-600" />
            Download Workbook (.jii)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        className="inline-flex h-[34px] shrink-0 items-center justify-center gap-1.5 px-2.5 text-[12px] font-semibold leading-[18px] xl:h-[44px] xl:gap-2 xl:px-4 xl:text-[15px] xl:leading-[20px]"
        style={{ background: "#EDF2F6", borderRadius: 8, color: "#011111" }}
        onClick={onClearOutputs}
      >
        <Trash2 className="size-4" />
        <span className="hidden xl:inline">Clear all</span>
      </button>

      {isRunningAll ? (
        <button
          className="inline-flex h-[34px] shrink-0 items-center justify-center gap-1.5 px-2.5 text-[12px] font-semibold leading-[18px] xl:h-[44px] xl:gap-2 xl:px-4 xl:text-[15px] xl:leading-[20px]"
          style={{ background: "#DC2626", borderRadius: 8, color: "#FFFFFF" }}
          onClick={onStopExecution}
        >
          <Square className="size-4 fill-current" />
          <span className="hidden xl:inline">Stop</span>
        </button>
      ) : (
        <button
          className={cn(
            "inline-flex h-[34px] shrink-0 items-center justify-center gap-1.5 px-2.5 text-[12px] font-semibold leading-[18px] xl:h-[44px] xl:gap-2 xl:px-4 xl:text-[15px] xl:leading-[20px]",
            cells.length === 0 && "cursor-not-allowed opacity-50",
          )}
          style={{ background: "#005E5E", borderRadius: 8, color: "#FFFFFF" }}
          onClick={onRunAll}
          disabled={cells.length === 0}
        >
          <Play className="size-4 fill-current" />
          <span className="hidden xl:inline">Run all</span>
        </button>
      )}
    </div>
  );
}
