import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";

interface LoadFailedProps {
  onRetry: () => void;
}

/** A failed read, kept apart from any empty state so it never reads as "nothing here". */
export function LoadFailed({ onRetry }: LoadFailedProps) {
  const { t } = useTranslation("fieldSessions");

  return (
    <EmptyState
      variant="error"
      description={t("loadError")}
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      }
    />
  );
}
