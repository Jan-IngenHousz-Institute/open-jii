"use client";

import { AutosaveIndicator } from "@/components/shared/autosave/autosave-indicator";
import { tsr } from "@/lib/tsr";
import { decodeBase64 } from "@/util/base64";
import {
  ChevronDown,
  Circle,
  Code,
  Download,
  File,
  FileCode,
  FileJson,
  GitBranch,
  Play,
  Square,
  Trash2,
  Usb,
} from "lucide-react";
import { useCallback } from "react";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";

import type { SensorFamily } from "@repo/api/schemas/protocol.schema";
import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
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

interface DeviceInfo {
  device_name?: string;
  device_battery?: number;
  device_version?: string;
  device_id?: string;
}

interface WorkbookHeaderProps {
  title: string;
  cells: WorkbookCell[];
  isConnected: boolean;
  isConnecting: boolean;
  deviceInfo: DeviceInfo | null;
  sensorFamily: SensorFamily;
  onSensorFamilyChange?: (family: SensorFamily) => void;
  connectionType: "bluetooth" | "serial";
  onConnectionTypeChange?: (type: "bluetooth" | "serial") => void;
  onConnect: () => void;
  onDisconnect: () => void;
  isRunningAll: boolean;
  onRunAll: () => void;
  onStopExecution: () => void;
  onClearOutputs: () => void;
  isSticky?: boolean;
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
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isLgTablet = useIsLgTablet();
  const compact = isMobile || isTablet || isLgTablet;

  const browserSupport = useIotBrowserSupport(sensorFamily);
  const transportSupported =
    connectionType === "serial" ? browserSupport.serial : browserSupport.bluetooth;
  const transportTooltip = transportSupported
    ? null
    : connectionType === "serial"
      ? browserSupport.serialReason === "browser"
        ? "Your browser does not support Web Serial. Use Chrome or Edge."
        : "This device does not support serial."
      : browserSupport.bluetoothReason === "browser"
        ? "Your browser does not support Web Bluetooth. Use Chrome or Edge."
        : "This device does not support Bluetooth.";

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
      const result = await tsr.protocols.getProtocol.query({
        params: { id: cell.payload.protocolId },
      });
      if (result.status !== 200) continue;
      const { name, code } = result.body;
      const filename = `${slugify(name)}.json`;
      downloadFile(JSON.stringify(code, null, 2), filename, "application/json");
    }
  }, [cells]);

  const handleExportMacro = useCallback(async () => {
    const macroCells = cells.filter((c) => c.type === "macro");
    if (macroCells.length === 0) return;

    // Use the macro's display name, not the stored DB filename (which can be
    // a generic placeholder like seed_macro_e5664d67...).
    for (const cell of macroCells) {
      const result = await tsr.macros.getMacro.query({
        params: { id: cell.payload.macroId },
      });
      if (result.status !== 200) continue;
      const { name, language, code } = result.body;
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

  return (
    <div
      className="sticky top-16 z-30 flex items-center gap-2 rounded-b-xl border-b px-4 py-2 xl:gap-3 xl:py-3"
      style={{ background: "#FFFFFF", borderColor: "#EDF2F6" }}
    >
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

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1.5 text-[12px] font-semibold leading-[18px]",
                "h-[34px] px-2.5 xl:h-[38px] xl:gap-2 xl:px-3 xl:text-[13px]",
                (isConnecting || (!isConnected && !transportSupported)) &&
                  "cursor-not-allowed opacity-50",
              )}
              style={
                isConnected
                  ? { background: "#EDF2F6", borderRadius: 8, color: "#011111" }
                  : { background: "#005E5E", borderRadius: 8, color: "#FFFFFF" }
              }
              onClick={isConnected ? onDisconnect : onConnect}
              disabled={isConnecting || (!isConnected && !transportSupported)}
            >
              <Usb className="size-4" />
              <span className="hidden xl:inline">{isConnected ? "Disconnect" : "Connect"}</span>
            </button>
          </TooltipTrigger>
          {transportTooltip && (
            <TooltipContent>
              <p>{transportTooltip}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

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

      <div className="flex-1" />

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
            onClick={() => void handleExportProtocol()}
            className="gap-2"
            disabled={!hasProtocols}
          >
            <FileCode className="size-4 text-emerald-600" />
            Export Protocol Only
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void handleExportMacro()}
            className="gap-2"
            disabled={!hasMacros}
          >
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
