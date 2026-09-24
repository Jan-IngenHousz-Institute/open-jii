"use client";

import { ArrowDown, ArrowUp, MessageSquare, MoreHorizontal, Trash2 } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

interface CalibrationStepActionsProps {
  position: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isSkippable: boolean;
  isOptional: boolean;
  /** A reading with no instruction for the operator can be given one. */
  canAskFirst: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleOptional: () => void;
  onAskFirst: () => void;
  onRemove: () => void;
}

/**
 * A step's actions behind one button, as a table row keeps them: one tab stop, a menu the
 * arrow keys walk, and nothing floating over the sentence while the pointer passes.
 */
export function CalibrationStepActions({
  position,
  canMoveUp,
  canMoveDown,
  isSkippable,
  isOptional,
  canAskFirst,
  onMoveUp,
  onMoveDown,
  onToggleOptional,
  onAskFirst,
  onRemove,
}: CalibrationStepActionsProps) {
  const { t } = useTranslation("iot");

  // A touch screen has no hover to reveal it, so there it simply stays.
  return (
    <div className="self-start opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("iot.calibration.procedure.menu.label", { position })}
            className="text-muted-foreground data-[state=open]:bg-accent -my-0.5 size-7"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem disabled={!canMoveUp} onSelect={onMoveUp}>
            <ArrowUp className="mr-2 size-4" aria-hidden />
            {t("iot.calibration.procedure.menu.moveUp")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canMoveDown} onSelect={onMoveDown}>
            <ArrowDown className="mr-2 size-4" aria-hidden />
            {t("iot.calibration.procedure.menu.moveDown")}
          </DropdownMenuItem>

          {(isSkippable || canAskFirst) && <DropdownMenuSeparator />}
          {isSkippable && (
            <DropdownMenuCheckboxItem checked={isOptional} onCheckedChange={onToggleOptional}>
              {t("iot.calibration.procedure.maySkip")}
            </DropdownMenuCheckboxItem>
          )}
          {canAskFirst && (
            <DropdownMenuItem onSelect={onAskFirst}>
              <MessageSquare className="mr-2 size-4" aria-hidden />
              {t("iot.calibration.procedure.menu.askFirst")}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onRemove}>
            <Trash2 className="mr-2 size-4" aria-hidden />
            {t("iot.calibration.procedure.menu.remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
