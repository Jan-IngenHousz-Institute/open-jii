"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { useTranslation } from "@repo/i18n/client";
import type { DayRecord, Incident, StatusComponent } from "@repo/monitoring/status-document";

import { HistoryDay } from "./history-day";
import { padDays } from "./history-days";

interface HistoryStripProps {
  component: StatusComponent;
  incidents: Incident[];
  generatedAt: string;
  checksBegan: string;
  dayCount: number;
  describedBy: string;
}

function targetIndex(key: string, current: number, last: number) {
  if (key === "ArrowLeft") {
    return Math.max(0, current - 1);
  }

  if (key === "ArrowRight") {
    return Math.min(last, current + 1);
  }

  if (key === "Home") {
    return 0;
  }

  return key === "End" ? last : undefined;
}

// One tab stop per strip; the arrow keys, Home and End move between days, and focus from any
// source makes its bar the stop. The stop is counted back from today so it survives a resize.
export function HistoryStrip({
  component,
  incidents,
  generatedAt,
  checksBegan,
  dayCount,
  describedBy,
}: HistoryStripProps) {
  const { t } = useTranslation("status");
  const [daysBeforeStop, setDaysBeforeStop] = useState(0);
  const [openIndex, setOpenIndex] = useState<number>();
  const bars = useRef<(HTMLSpanElement | null)[]>([]);

  const days = useMemo(
    () => padDays(component.days, checksBegan).slice(-dayCount),
    [component.days, checksBegan, dayCount],
  );
  const lastIndex = days.length - 1;
  const stopIndex = Math.max(0, lastIndex - daysBeforeStop);

  const keepBar = useCallback((index: number, element: HTMLSpanElement | null) => {
    bars.current[index] = element;
  }, []);

  const focusBar = useCallback(
    (index: number) => {
      setDaysBeforeStop(lastIndex - index);
    },
    [lastIndex],
  );

  const changeOpen = useCallback((index: number, isOpen: boolean) => {
    setOpenIndex((current) => {
      if (isOpen) {
        return index;
      }

      return current === index ? undefined : current;
    });
  }, []);

  function moveFocus(event: KeyboardEvent) {
    const index = targetIndex(event.key, stopIndex, lastIndex);
    if (index === undefined) {
      return;
    }

    event.preventDefault();
    bars.current[index]?.focus();
  }

  function renderDay(day: DayRecord, index: number) {
    return (
      <HistoryDay
        key={day.date}
        index={index}
        dayCount={dayCount}
        day={day}
        incidents={incidents}
        generatedAt={generatedAt}
        checksBegan={checksBegan}
        isToday={index === lastIndex}
        isStop={index === stopIndex}
        isOpen={index === openIndex}
        onKeepBar={keepBar}
        onFocusBar={focusBar}
        onOpenChange={changeOpen}
      />
    );
  }

  return (
    <div
      role="group"
      aria-label={t("history.group", { name: t(`component.${component.id}.name`), days: dayCount })}
      aria-describedby={describedBy}
      onKeyDown={moveFocus}
      className="grid h-8 auto-cols-fr grid-flow-col gap-[2px]"
    >
      {days.map(renderDay)}
    </div>
  );
}
