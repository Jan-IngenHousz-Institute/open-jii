"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";

import type { DatasetDeposit, DepositStatus } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

const STATUS_TONES: Record<DepositStatus, StatusTone> = {
  uploading: "archived",
  registering: "archived",
  verifying: "archived",
  deposited: "active",
  failed: "destructive",
};

function DepositStatusIcon({ status }: { status: DepositStatus }) {
  if (status === "deposited") {
    return <CheckCircle2 className="size-3" aria-hidden />;
  }
  if (status === "failed") {
    return <CircleAlert className="size-3" aria-hidden />;
  }
  return <Loader2 className="size-3 animate-spin" aria-hidden />;
}

export function DatasetDepositStatus({ deposit }: { deposit: DatasetDeposit }) {
  const { t } = useTranslation("datasets");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge tone={STATUS_TONES[deposit.status]}>
        <DepositStatusIcon status={deposit.status} />
        {t(`deposit.${deposit.status}`)}
      </StatusBadge>
      <Badge variant="outline" className="text-muted-foreground font-medium">
        {t(`environment.${deposit.environment}`)}
      </Badge>
    </div>
  );
}
