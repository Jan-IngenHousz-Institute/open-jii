"use client";

import { IotDevicesList } from "@/components/iot-devices/iot-devices-list";
import { RegisterIotDeviceDialog } from "@/components/iot-devices/register-iot-device-dialog";
import { useIotDevices } from "@/hooks/iot/useIotDevices/useIotDevices";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

export function IotDevicesView() {
  const { t } = useTranslation("iot");
  const { data: devicesData, isLoading, isError } = useIotDevices();
  const devices = useMemo(() => devicesData?.body ?? [], [devicesData]);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">{t("devices.title")}</h1>
          <p className="text-muted-foreground">{t("devices.description")}</p>
        </div>
        <Button onClick={() => setIsRegisterOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("devices.register")}
        </Button>
      </div>

      {isError ? (
        <p className="text-destructive text-sm">{t("devices.loadError")}</p>
      ) : (
        <IotDevicesList devices={devices} isLoading={isLoading} />
      )}

      <RegisterIotDeviceDialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen} />
    </div>
  );
}
