"use client";

import { Plus, RadioReceiver } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";

export function IotDevicesEmptyState({ onRegister }: { onRegister: () => void }) {
  const { t } = useTranslation("iot");

  return (
    <EmptyState
      size="page"
      icon={<RadioReceiver aria-hidden />}
      title={t("iot.devices.empty.title")}
      description={t("iot.devices.empty.description")}
      action={
        <Button onClick={onRegister}>
          <Plus className="mr-2 h-4 w-4" />
          {t("iot.devices.empty.cta")}
        </Button>
      }
    />
  );
}
