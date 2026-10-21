import { CalendarDays } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";

/** The Field days view while plots exist and nobody has started a session. */
export function FieldDaysEmptyState() {
  const { t } = useTranslation("experiments");

  return (
    <EmptyState
      size="page"
      icon={<CalendarDays aria-hidden />}
      title={t("layout.fieldDaysEmpty.title")}
      description={t("layout.fieldDaysEmpty.description")}
    />
  );
}
