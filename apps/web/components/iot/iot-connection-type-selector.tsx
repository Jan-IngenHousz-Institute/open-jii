"use client";

import { Bluetooth, Usb } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components";

interface ConnectionTypeSelectorProps {
  connectionType: "bluetooth" | "serial";
  onConnectionTypeChange: (type: "bluetooth" | "serial") => void;
  browserSupport: {
    bluetooth: boolean;
    serial: boolean;
  };
}

export function ConnectionTypeSelector({
  connectionType,
  onConnectionTypeChange,
  browserSupport,
}: ConnectionTypeSelectorProps) {
  const { t } = useTranslation("iot");

  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-medium">{t("iot.protocolRunner.connectionType")}</h3>
      <div className="grid grid-cols-2 gap-1.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  type="button"
                  variant={connectionType === "bluetooth" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onConnectionTypeChange("bluetooth")}
                  className="w-full gap-1.5 overflow-hidden px-2"
                  disabled={!browserSupport.bluetooth}
                >
                  <Bluetooth className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t("iot.protocolRunner.bluetooth")}</span>
                </Button>
              </div>
            </TooltipTrigger>
            {!browserSupport.bluetooth && (
              <TooltipContent>
                <p>{t("iot.protocolRunner.webBluetoothNotSupported")}</p>
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
                  variant={connectionType === "serial" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onConnectionTypeChange("serial")}
                  className="w-full gap-1.5 overflow-hidden px-2"
                  disabled={!browserSupport.serial}
                >
                  <Usb className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t("iot.protocolRunner.serial")}</span>
                </Button>
              </div>
            </TooltipTrigger>
            {!browserSupport.serial && (
              <TooltipContent>
                <p>{t("iot.protocolRunner.webSerialNotSupported")}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
