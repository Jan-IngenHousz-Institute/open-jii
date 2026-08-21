"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { Plus, RadioReceiver } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

export function IotDevicesEmptyState({ onRegister }: { onRegister: () => void }) {
  const { t } = useTranslation("iot");

  return (
    <EmptyState
      icon={RadioReceiver}
      title={t("iot.devices.empty.title")}
      description={t("iot.devices.empty.description")}
    >
      <Button onClick={onRegister}>
        <Plus className="mr-2 h-4 w-4" />
        {t("iot.devices.empty.cta")}
      </Button>
    </EmptyState>
  );
}
