import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { WalkingStrategy } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Label } from "@repo/ui/components/label";
import { RadioGroupItem } from "@repo/ui/components/radio-group";
import { cn } from "@repo/ui/lib/utils";

interface WalkingStrategyOptionProps {
  strategy: WalkingStrategy;
  isRecommended: boolean;
  isDisabled: boolean;
  /** A strategy that reads plot attributes on plots without any, which links to where they are added. */
  needsAttributes: boolean;
  /** The attribute the strategy reads, picked under its description. */
  picker?: ReactNode;
}

export function WalkingStrategyOption({
  strategy,
  isRecommended,
  isDisabled,
  needsAttributes,
  picker,
}: WalkingStrategyOptionProps) {
  const { t } = useTranslation("fieldSessions");
  const pathname = usePathname();
  const inputId = `walking-strategy-${strategy}`;
  const isTimeOfDayRisk = strategy === "byRow";

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        !isDisabled && "hover:bg-muted/40",
      )}
    >
      <RadioGroupItem value={strategy} id={inputId} disabled={isDisabled} className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-2">
        <Label htmlFor={inputId} className="cursor-pointer flex-col items-start gap-1 font-normal">
          <span className="flex items-center gap-2 text-sm font-medium">
            {t(`walkingOrder.strategies.${strategy}.label`)}
            {isRecommended ? (
              <Badge className="bg-status-active text-status-active-foreground">
                {t("walkingOrder.recommended")}
              </Badge>
            ) : null}
          </span>
          <span className="text-muted-foreground text-xs leading-relaxed">
            {isTimeOfDayRisk ? (
              <TriangleAlert className="text-status-stale-foreground mr-1 inline size-3.5 align-[-2px]" />
            ) : null}
            {t(`walkingOrder.strategies.${strategy}.description`)}
          </span>
        </Label>
        {needsAttributes ? (
          <Link href={`${pathname}?view=plots`} className="text-primary text-xs underline">
            {t("walkingOrder.addAttributes")}
          </Link>
        ) : (
          picker
        )}
      </div>
    </div>
  );
}
