"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";
import { CheckCircle2, FlaskConical, Loader2, RotateCw, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { DatasetDeposit } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface DepositLook {
  icon: LucideIcon;
  tone: StatusTone;
  labelKey: string;
  spin: boolean;
}

/** The upload status badge's shape: one icon and tone per state, and a test deposit never green. */
function depositLook(deposit: DatasetDeposit): DepositLook {
  if (deposit.status === "failed") {
    return { icon: XCircle, tone: "destructive", labelKey: "deposit.failed", spin: false };
  }
  if (deposit.status !== "deposited") {
    return { icon: Loader2, tone: "published", labelKey: `deposit.${deposit.status}`, spin: true };
  }
  if (deposit.environment === "sandbox") {
    return { icon: FlaskConical, tone: "stale", labelKey: "deposit.testDeposit", spin: false };
  }
  return { icon: CheckCircle2, tone: "active", labelKey: "deposit.deposited", spin: false };
}

interface DatasetDepositStatusProps {
  deposit: DatasetDeposit;
  /** Admins and members may retry; others only read the outcome. */
  canRetry: boolean;
}

export function DatasetDepositStatus({ deposit, canRetry }: DatasetDepositStatusProps) {
  const { t } = useTranslation("datasets");
  const look = depositLook(deposit);
  const Icon = look.icon;
  const failedStep = deposit.status === "failed" ? deposit.failedStep : null;

  return (
    <div className="space-y-1.5">
      <StatusBadge tone={look.tone}>
        <Icon className={look.spin ? "size-3 animate-spin" : "size-3"} aria-hidden />
        {t(look.labelKey)}
      </StatusBadge>
      {failedStep !== null ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground text-xs">
            {t(`deposit.failedAt.${failedStep}`, { count: deposit.attempts })}
          </p>
          {canRetry ? (
            <Button variant="outline" size="sm" className="h-7">
              <RotateCw className="size-3.5" aria-hidden />
              {t("deposit.retry")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
