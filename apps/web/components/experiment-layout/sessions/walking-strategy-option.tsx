import { TriangleAlert } from "lucide-react";

import type { WalkingStrategy } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import { Label } from "@repo/ui/components/label";
import { RadioGroupItem } from "@repo/ui/components/radio-group";

interface WalkingStrategyOptionProps {
  strategy: WalkingStrategy;
}

export function WalkingStrategyOption({ strategy }: WalkingStrategyOptionProps) {
  const { t } = useTranslation("fieldSessions");
  const inputId = `walking-strategy-${strategy}`;
  const isTimeOfDayRisk = strategy === "byRow";

  return (
    <div className="hover:bg-muted/40 flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors">
      <RadioGroupItem value={strategy} id={inputId} className="mt-0.5" />
      <Label
        htmlFor={inputId}
        className="min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 font-normal"
      >
        <span className="text-sm font-medium">
          {t(`walkingOrder.strategies.${strategy}.label`)}
        </span>
        <span className="text-muted-foreground text-xs leading-relaxed">
          {isTimeOfDayRisk ? (
            <TriangleAlert className="text-status-stale-foreground mr-1 inline size-3.5 align-[-2px]" />
          ) : null}
          {t(`walkingOrder.strategies.${strategy}.description`)}
        </span>
      </Label>
    </div>
  );
}
