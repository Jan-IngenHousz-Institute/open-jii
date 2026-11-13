"use client";

import { memo, useCallback, useRef } from "react";
import type { PointerEvent } from "react";
import { useFormat } from "~/hooks/use-format";

import { useTranslation } from "@repo/i18n/client";
import type { DayRecord, Incident } from "@repo/monitoring/status-document";
import {
  HoverCard,
  HoverCardContent,
  HoverCardPortal,
  HoverCardTrigger,
} from "@repo/ui/components/hover-card";
import { cn } from "@repo/ui/lib/utils";

import { DayDetails } from "./day-details";
import { summarizeDay } from "./day-summary";
import { CELL } from "./history-cells";
import { useDayLabel } from "./use-day-label";

// Long enough for the pointer to cross to the card (WCAG 1.4.13); the next bar's card still replaces it at once.
const CARD_CLOSE_DELAY_MS = 200;

interface HistoryDayProps {
  index: number;
  day: DayRecord;
  incidents: Incident[];
  generatedAt: string;
  checksBegan: string;
  isToday: boolean;
  isStop: boolean;
  isOpen: boolean;
  onKeepBar: (index: number, element: HTMLSpanElement | null) => void;
  onFocusBar: (index: number) => void;
  onOpenChange: (index: number, isOpen: boolean) => void;
}

// Only the strip's current stop is exposed to assistive tech; the card repeats the bar's label.
export const HistoryDay = memo(function HistoryDay({
  index,
  day,
  incidents,
  generatedAt,
  checksBegan,
  isToday,
  isStop,
  isOpen,
  onKeepBar,
  onFocusBar,
  onOpenChange,
}: HistoryDayProps) {
  const { t } = useTranslation("status");
  const format = useFormat();
  const summary = summarizeDay(day, incidents, generatedAt);
  const label = useDayLabel(day.date, summary, checksBegan, isToday);
  const wasOpenOnPress = useRef(false);

  const keepBar = useCallback(
    (element: HTMLSpanElement | null) => {
      onKeepBar(index, element);
    },
    [index, onKeepBar],
  );

  function focusBar() {
    onFocusBar(index);
  }

  function changeOpen(isNowOpen: boolean) {
    onOpenChange(index, isNowOpen);
  }

  // The card's own outside-press handling has closed it by the time the press ends.
  function press() {
    wasOpenOnPress.current = isOpen;
  }

  function release(event: PointerEvent) {
    const isTapOnOpenBar = event.pointerType === "touch" && wasOpenOnPress.current;
    onOpenChange(index, !isTapOnOpenBar);
  }

  return (
    <HoverCard
      open={isOpen}
      onOpenChange={changeOpen}
      openDelay={0}
      closeDelay={CARD_CLOSE_DELAY_MS}
    >
      <HoverCardTrigger asChild>
        <span
          ref={keepBar}
          role="img"
          tabIndex={isStop ? 0 : -1}
          aria-hidden={isStop ? undefined : true}
          aria-label={label}
          onFocus={focusBar}
          onPointerDown={press}
          onPointerUp={release}
          className={cn(
            "focus-visible:outline-ring rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2",
            CELL[day.state],
          )}
        />
      </HoverCardTrigger>
      <HoverCardPortal>
        {/* No fade, so sweeping along the bars swaps one card for the next. */}
        <HoverCardContent
          side="bottom"
          collisionPadding={8}
          aria-hidden
          className="data-[state=closed]:animate-none! data-[state=open]:animate-none! w-72 p-0 text-sm"
        >
          <p className="px-4 pt-3 font-semibold">{format.date(day.date)}</p>
          {isToday ? (
            <p className="text-muted-foreground px-4 text-xs">{t("day.partial")}</p>
          ) : null}
          <DayDetails summary={summary} checksBegan={checksBegan} />
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
});
