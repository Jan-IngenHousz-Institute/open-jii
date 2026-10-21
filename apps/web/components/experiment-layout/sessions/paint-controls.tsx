import { RotateCcw, Undo2 } from "lucide-react";

import type { FieldShare } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";

import type { FieldShares } from "./field-shares";
import { ShareSwatch } from "./share-swatch";

interface PaintControlsProps {
  shares: FieldShares;
  paintInto: string | null;
  onPaintIntoChange: (userId: string | null) => void;
  canUndo: boolean;
  onUndo: () => void;
  onReset: () => void;
}

/** Which share a stroke paints into, with Undo for the last stroke and Reset for all of them. */
export function PaintControls({
  shares,
  paintInto,
  onPaintIntoChange,
  canUndo,
  onUndo,
  onReset,
}: PaintControlsProps) {
  const { t } = useTranslation("fieldSessions");

  const handlePaintIntoChange = (userId: string) => {
    onPaintIntoChange(userId === "" ? null : userId);
  };

  const renderTarget = (share: FieldShare) => (
    <ToggleGroupItem key={share.userId} value={share.userId} className="gap-1.5 px-3">
      <ShareSwatch style={shares.styleOf(share.userId)} />
      {shares.nameOf(share.userId)}
    </ToggleGroupItem>
  );

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{t("divide.paintHint")}</p>
      <div className="space-y-1.5">
        <span className="text-sm">{t("divide.paintInto")}</span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={paintInto ?? ""}
          onValueChange={handlePaintIntoChange}
          className="flex-wrap justify-start"
        >
          {shares.shares.map(renderTarget)}
        </ToggleGroup>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="size-4" aria-hidden />
          {t("divide.undo")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onReset} disabled={!canUndo}>
          <RotateCcw className="size-4" aria-hidden />
          {t("divide.reset")}
        </Button>
      </div>
    </div>
  );
}
