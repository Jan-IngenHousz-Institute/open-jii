import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface MeasuredTwicePanelProps {
  plots: readonly string[];
}

export function MeasuredTwicePanel({ plots }: MeasuredTwicePanelProps) {
  const { t } = useTranslation("fieldSessions");
  const pathname = usePathname();

  return (
    <div className="bg-muted/40 space-y-2 rounded-lg border p-4">
      <p className="text-sm font-medium">{t("overview.measuredTwice", { count: plots.length })}</p>
      <p className="text-muted-foreground text-sm">
        {t("overview.measuredTwiceHint", { plots: plots.join(", ") })}
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href={`${pathname}?sessions=review`}>{t("overview.openNeedsReview")}</Link>
      </Button>
    </div>
  );
}
