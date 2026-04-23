"use client";

import { Bluetooth, Usb } from "lucide-react";
import type { TransportUnavailableReason } from "~/hooks/iot/useIotBrowserSupport";

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
}

export function ConnectionTypeSelector({
  connectionType,
  onConnectionTypeChange,
  browserSupport,
}: ConnectionTypeSelectorProps) {
  const { t } = useTranslation("iot");

  const bluetoothTooltip =
    browserSupport.bluetoothReason === "device"
      ? t("iot.protocolRunner.deviceNoBLE")
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
                      ? "bg-background text-foreground hover:bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-transparent",
                  )}
                  disabled={!browserSupport.bluetooth}
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
                      ? "bg-background text-foreground hover:bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-transparent",
                  )}
                  disabled={!browserSupport.serial}
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
    </div>
  );
}
