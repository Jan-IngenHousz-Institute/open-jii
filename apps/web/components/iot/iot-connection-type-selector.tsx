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
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{t("iot.protocolTester.connectionType")}</h3>
      <div className="grid grid-cols-2 gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  type="button"
                  variant={connectionType === "bluetooth" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onConnectionTypeChange("bluetooth")}
                  className="w-full justify-start"
                  disabled={!browserSupport.bluetooth}
                >
                  <Bluetooth className="mr-2 h-4 w-4" />
                  {t("iot.protocolTester.bluetooth")}
                </Button>
              </div>
            </TooltipTrigger>
            {!browserSupport.bluetooth && (
              <TooltipContent>
                <p>{t("iot.protocolTester.webBluetoothNotSupported")}</p>
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
                  className="w-full justify-start"
                  disabled={!browserSupport.serial}
                >
                  <Usb className="mr-2 h-4 w-4" />
                  {t("iot.protocolTester.serial")}
                </Button>
              </div>
            </TooltipTrigger>
            {!browserSupport.serial && (
              <TooltipContent>
                <p>{t("iot.protocolTester.webSerialNotSupported")}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
