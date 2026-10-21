import type { ExperimentDataFilterValue } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

export function BooleanInput({
  value,
  onChange,
}: {
  value: ExperimentDataFilterValue;
  onChange: (value: ExperimentDataFilterValue) => void;
}) {
  const { t } = useTranslation("common");
  return (
    <Select
      value={typeof value === "boolean" ? String(value) : ""}
      onValueChange={(next) => onChange(next === "true")}
    >
      <SelectTrigger aria-label={t("dataFilters.placeholderValue")} className="h-9 w-full">
        <SelectValue placeholder={t("dataFilters.placeholderValue")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="true">{t("common.yes")}</SelectItem>
        <SelectItem value="false">{t("common.no")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
