"use client";

import { Building2, Lock } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

// JII's ROR identifier, which DataCite records carry for the HostingInstitution contributor.
const HOSTING_ROR = "01svd5660";

/** JII as every dataset's hosting institution, which the platform sets and nobody removes. */
export function HostingInstitutionRow() {
  const { t } = useTranslation("datasets");

  return (
    <div
      className="flex items-center gap-3 rounded-md border px-3 py-2.5"
      data-testid="hosting-institution"
    >
      <span className="bg-muted text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
        <Building2 className="size-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{t("describe.hostingName")}</p>
          <Badge variant="secondary">{t("describe.hostingTitle")}</Badge>
        </div>
        <p className="text-muted-foreground text-xs">
          {t("describe.hostingDetail", { ror: HOSTING_ROR })}
        </p>
      </div>

      <Lock className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </div>
  );
}
