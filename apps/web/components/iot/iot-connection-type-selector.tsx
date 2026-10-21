"use client";

import { Bluetooth, Usb } from "lucide-react";
import { env } from "~/env";
import type { TransportUnavailableReason } from "~/hooks/iot/useIotBrowserSupport";
import { useIsHydrated } from "~/hooks/useIsHydrated";
import { isDesktopShell } from "~/lib/platform";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";

interface ConnectionTypeSelectorProps {
  connectionType: "bluetooth" | "serial";
  onConnectionTypeChange: (type: "bluetooth" | "serial") => void;
  browserSupport: {
    bluetooth: boolean;
    serial: boolean;
    bluetoothReason: TransportUnavailableReason;
    serialReason: TransportUnavailableReason;
  };
  /**
   * True when the selected device speaks Bluetooth Classic but not BLE, so Web
   * Bluetooth cannot reach it. Shows accurate Classic-vs-BLE guidance.
   */
  bluetoothClassicOnly?: boolean;
  /** Locks the row while connected: the active pipe stays visible, never hidden. */
  disabled?: boolean;
}

export function ConnectionTypeSelector({
  connectionType,
  onConnectionTypeChange,
  browserSupport,
  bluetoothClassicOnly = false,
  disabled = false,
}: ConnectionTypeSelectorProps) {
  const { t } = useTranslation("iot");
  const isHydrated = useIsHydrated();
  const inDesktopApp = isHydrated && isDesktopShell();
  const browserLacksSerial = isHydrated && !inDesktopApp && browserSupport.serialReason === "browser";
  const showDesktopBluetoothHint = inDesktopApp && bluetoothClassicOnly && !disabled;

  const bluetoothTooltip =
    browserSupport.bluetoothReason === "device"
      ? bluetoothClassicOnly
        ? t("iot.protocolRunner.bluetoothClassicHint")
        : t("iot.protocolRunner.deviceNoBLE")
      : browserSupport.bluetoothReason === "browser"
        ? t("iot.protocolRunner.webBluetoothNotSupported")
        : undefined;

  const serialTooltip =
    browserSupport.serialReason === "device"
      ? t("iot.protocolRunner.deviceNoSerial")
      : browserSupport.serialReason === "browser"
        ? t("iot.protocolRunner.webSerialNotSupported")
        : undefined;

  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-medium">{t("iot.protocolRunner.connectionType")}</h3>
      <div className="bg-muted inline-flex rounded-md p-0.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onConnectionTypeChange("bluetooth")}
                  className={cn(
                    "h-7 gap-1.5 rounded-sm px-2.5 text-xs",
                    connectionType === "bluetooth"
                      ? "bg-background text-foreground hover:bg-background shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-transparent",
                  )}
                  disabled={disabled || !browserSupport.bluetooth}
                >
                  <Bluetooth className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t("iot.protocolRunner.bluetooth")}</span>
                </Button>
              </div>
            </TooltipTrigger>
            {bluetoothTooltip && (
              <TooltipContent>
                <p>{bluetoothTooltip}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onConnectionTypeChange("serial")}
                  className={cn(
                    "h-7 gap-1.5 rounded-sm px-2.5 text-xs",
                    connectionType === "serial"
                      ? "bg-background text-foreground hover:bg-background shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-transparent",
                  )}
                  disabled={disabled || !browserSupport.serial}
                >
                  <Usb className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t("iot.protocolRunner.serial")}</span>
                </Button>
              </div>
            </TooltipTrigger>
            {serialTooltip && (
              <TooltipContent>
                <p>{serialTooltip}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
      {!disabled && !browserSupport.bluetooth && !browserSupport.serial && (
        <p className="text-muted-foreground text-xs">
          {serialTooltip ?? bluetoothTooltip ?? t("iot.protocolRunner.webSerialNotSupported")}
        </p>
      )}
      {!disabled && browserLacksSerial && (
        <p className="text-xs">
          <a
            className="text-primary font-medium underline-offset-4 hover:underline"
            href={`${env.NEXT_PUBLIC_DOCS_URL}/guide/get-started/desktop-app`}
            target="_blank"
            rel="noreferrer"
          >
            {t("iot.protocolRunner.getDesktopApp")}
          </a>
        </p>
      )}
      {showDesktopBluetoothHint && (
        <p className="text-muted-foreground text-xs">{t("iot.protocolRunner.bluetoothClassicDesktopHint")}</p>
      )}
    </div>
  );
}
