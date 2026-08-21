import { Clock } from "lucide-react";

import { useTranslation } from "@repo/i18n";

interface ComingSoonPanelProps {
  description: string;
}

export function ComingSoonPanel({ description }: ComingSoonPanelProps) {
  const { t } = useTranslation("iot");

  return (
    <div className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
      <div className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full">
        <Clock className="h-5 w-5" />
      </div>
      <p className="text-foreground text-sm font-semibold">{t("iot.devices.comingSoon.title")}</p>
      <p className="text-muted-foreground max-w-md text-sm">{description}</p>
    </div>
  );
}
