"use client";

import { Plus, RadioReceiver } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";

export function IotDevicesEmptyState({ onRegister }: { onRegister: () => void }) {
  const { t } = useTranslation("iot");

  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="bg-muted mb-4 flex h-24 w-24 items-center justify-center rounded-full">
          <RadioReceiver className="text-muted-foreground h-12 w-12" />
        </div>
        <h3 className="text-foreground text-base font-medium">{t("devices.empty.title")}</h3>
        <p className="text-muted-foreground mt-1 max-w-md text-center text-sm">
          {t("devices.empty.description")}
        </p>
        <Button className="mt-4" onClick={onRegister}>
          <Plus className="mr-2 h-4 w-4" />
          {t("devices.empty.cta")}
        </Button>
      </CardContent>
    </Card>
  );
}
