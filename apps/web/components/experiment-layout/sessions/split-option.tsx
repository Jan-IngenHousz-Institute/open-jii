import { useLocale } from "@/hooks/useLocale";

import type { FieldSplit } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import { Label } from "@repo/ui/components/label";
import { RadioGroupItem } from "@repo/ui/components/radio-group";

import type { FieldPlan } from "./field-plan";

interface SplitOptionProps {
  split: FieldSplit;
  plan: FieldPlan;
  measurerIds: readonly string[];
  isDisabled: boolean;
}

/** One way to cut the walk between measurers, saying what it protects and what it costs. */
export function SplitOption({ split, plan, measurerIds, isDisabled }: SplitOptionProps) {
  const { t } = useTranslation("fieldSessions");
  const locale = useLocale();
  const inputId = `field-split-${split}`;

  const sizes = plan.split(split, measurerIds).map((share) => share.unitIds.length);
  const isUneven = split === "rowBands" && new Set(sizes).size > 1;
  const sizeList = new Intl.ListFormat(locale, { type: "conjunction" }).format(sizes.map(String));

  return (
    <div className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
      <RadioGroupItem value={split} id={inputId} disabled={isDisabled} className="mt-0.5" />
      <Label
        htmlFor={inputId}
        className="min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 font-normal"
      >
        <span className="text-sm font-medium">{t(`divide.splits.${split}.label`)}</span>
        <span className="text-muted-foreground text-xs leading-relaxed">
          <span className="text-foreground font-medium">{t("divide.protects")}</span>{" "}
          {t(`divide.splits.${split}.protects`)}
        </span>
        <span className="text-muted-foreground text-xs leading-relaxed">
          <span className="text-foreground font-medium">{t("divide.costs")}</span>{" "}
          {t(`divide.splits.${split}.costs`)}
          {isUneven ? ` ${t("divide.splits.rowBands.uneven", { sizes: sizeList })}` : null}
        </span>
      </Label>
    </div>
  );
}
