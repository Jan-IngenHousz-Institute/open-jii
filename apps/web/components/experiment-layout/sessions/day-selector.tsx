import { useLocale } from "@/hooks/useLocale";
import { formatYmd } from "@/util/date";
import type { ReactNode } from "react";

import { useTranslation } from "@repo/i18n";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

interface DaySelectorProps {
  /** Days with sessions, as YYYY-MM-DD, newest first. */
  days: readonly string[];
  value: string;
  onChange: (day: string) => void;
  /** Whether every phone of the chosen day has uploaded. */
  status: ReactNode;
}

/** Picks which field day the Field days view sums up. */
export function DaySelector({ days, value, onChange, status }: DaySelectorProps) {
  const { t } = useTranslation("fieldSessions");
  const locale = useLocale();

  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

  const labelOf = (day: string) => {
    const date = new Date(`${day}T00:00:00`);
    const short = date.toLocaleDateString(locale, { day: "numeric", month: "long" });
    if (day === formatYmd(today)) {
      return t("fieldDays.todayOn", { date: short });
    }
    if (day === formatYmd(yesterday)) {
      return t("fieldDays.yesterdayOn", { date: short });
    }
    return date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  };

  const renderDay = (day: string) => (
    <SelectItem key={day} value={day}>
      {labelOf(day)}
    </SelectItem>
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Label htmlFor="field-day">{t("fieldDays.day")}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="field-day" className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{days.map(renderDay)}</SelectContent>
      </Select>
      {status}
    </div>
  );
}
