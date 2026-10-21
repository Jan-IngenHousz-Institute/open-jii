import { RefreshCw } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface OrderCodeLineProps {
  code: string;
  /** Absent for viewers, who see the code without Regenerate. */
  onRegenerate?: () => void;
}

/** What makes a random walking order repeatable, with one sentence on what changing it does. */
export function OrderCodeLine({ code, onRegenerate }: OrderCodeLineProps) {
  const { t } = useTranslation("fieldSessions");

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">{t("walkingOrder.orderCode")}</span>
        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">{code}</code>
        {onRegenerate ? (
          <Button type="button" variant="outline" size="sm" onClick={onRegenerate}>
            <RefreshCw className="size-4" aria-hidden />
            {t("walkingOrder.regenerate")}
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">{t("walkingOrder.orderCodeHint")}</p>
    </div>
  );
}
