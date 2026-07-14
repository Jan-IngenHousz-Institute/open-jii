import { Clock } from "lucide-react";

import { useTranslation } from "@repo/i18n";

interface ComingSoonPanelProps {
  description: string;
}

export function ComingSoonPanel({ description }: ComingSoonPanelProps) {
  const { t } = useTranslation("iot");

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#CDD5DB] px-6 py-16 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6F8FA] text-[#68737B]">
        <Clock className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-[#011111]">{t("iot.devices.comingSoon.title")}</p>
      <p className="text-muted-foreground max-w-md text-sm">{description}</p>
    </div>
  );
}
