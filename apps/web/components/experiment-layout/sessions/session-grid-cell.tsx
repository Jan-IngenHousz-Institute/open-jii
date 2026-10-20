import type { ReactNode } from "react";

import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

interface SessionGridCellProps {
  unit: ExperimentUnit | undefined;
  fillClassName?: string;
  /** A share's color, drawn as a heavier border. */
  borderClassName?: string;
  isDashed?: boolean;
  isHighlighted?: boolean;
  order?: number;
  marker?: ReactNode;
  isCompact?: boolean;
  onPointerDown?: (unit: ExperimentUnit) => void;
  onPointerEnter?: (unit: ExperimentUnit) => void;
}

export function SessionGridCell({
  unit,
  fillClassName,
  borderClassName,
  isDashed = false,
  isHighlighted = false,
  order,
  marker,
  isCompact = false,
  onPointerDown,
  onPointerEnter,
}: SessionGridCellProps) {
  const { t } = useTranslation("fieldSessions");

  if (!unit?.active) {
    return (
      <div
        title={t("gap")}
        className="text-muted-foreground flex h-full items-center justify-center rounded-md border border-dashed text-xs"
      >
        {isCompact ? null : t("gapShort")}
      </div>
    );
  }

  const hasOrder = order !== undefined;
  const showsIdentifier = !hasOrder;
  const handlePointerDown = () => onPointerDown?.(unit);
  const handlePointerEnter = () => onPointerEnter?.(unit);

  return (
    <div
      title={unit.identifier}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      className={cn(
        "text-foreground relative flex h-full items-center justify-center rounded-md font-medium",
        isCompact ? "text-[10px]" : "text-xs",
        fillClassName ?? "bg-primary/5",
        borderClassName ? cn("border-[3px]", borderClassName) : "border-primary/20 border",
        isDashed && "border-dashed",
        isHighlighted && "ring-foreground ring-2 ring-offset-1",
        onPointerDown && "cursor-pointer",
      )}
    >
      {hasOrder ? (
        <>
          <span className="absolute left-1 top-0.5 text-[11px] font-semibold leading-none">
            {order}
          </span>
          <span className="text-muted-foreground absolute bottom-0.5 right-1 text-[10px] leading-none">
            {unit.identifier}
          </span>
        </>
      ) : null}
      {showsIdentifier ? unit.identifier : null}
      {marker ? <span className="absolute right-0.5 top-0.5">{marker}</span> : null}
    </div>
  );
}
