"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { STATUS_HISTORY_DAYS } from "@repo/monitoring/status-document";

import { prefersReducedMotion } from "./reduced-motion";

type DominoRun = "fall" | "rise";

const KONAMI = [
  "arrowup",
  "arrowup",
  "arrowdown",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "arrowleft",
  "arrowright",
  "b",
  "a",
];

const LAST_DAY = STATUS_HISTORY_DAYS - 1;

// A full strip falls 25 ms a bar and a fall takes 240 ms, so the run ends near 2.5 s. A shorter
// strip spreads the same sweep over fewer bars.
const FALL_SWEEP_MS = LAST_DAY * 25;
const RISE_AT_MS = 3300;

// Standing back up runs right to left, faster, at 320 ms a bar.
const RISE_SWEEP_MS = LAST_DAY * 12;
const DONE_AT_MS = RISE_AT_MS + RISE_SWEEP_MS + 420;

const ANIMATION = {
  fall: { bar: "animate-domino-fall", last: "animate-domino-fall-flat" },
  rise: { bar: "animate-domino-rise", last: "animate-domino-rise-flat" },
};

interface DominoState {
  run: DominoRun | undefined;
  isEnabled: boolean;
}

const DominoContext = createContext<DominoState>({ run: undefined, isEnabled: false });

export function dominoAnimation(run: DominoRun | undefined, day: number, dayCount: number) {
  if (!run) {
    return { className: undefined, delay: undefined };
  }

  const lastDay = dayCount - 1;
  const isLast = day === lastDay;
  const sweepMs = run === "fall" ? FALL_SWEEP_MS : RISE_SWEEP_MS;
  const position = run === "fall" ? day : lastDay - day;
  const delayMs = Math.round((position * sweepMs) / lastDay);

  return { className: isLast ? ANIMATION[run].last : ANIMATION[run].bar, delay: `${delayMs}ms` };
}

export function useDominoes() {
  return useContext(DominoContext);
}

export function Dominoes({ isEnabled, children }: { isEnabled: boolean; children: ReactNode }) {
  const [run, setRun] = useState<DominoRun>();

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    let recent: string[] = [];
    let isRunning = false;
    const timers: number[] = [];

    function start() {
      isRunning = true;
      setRun("fall");
      timers.push(window.setTimeout(() => setRun("rise"), RISE_AT_MS));
      timers.push(
        window.setTimeout(() => {
          setRun(undefined);
          isRunning = false;
        }, DONE_AT_MS),
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      const isModifier = event.ctrlKey || event.metaKey || event.altKey || event.key === "Shift";
      if (isModifier) {
        return;
      }

      recent = [...recent, event.key.toLowerCase()].slice(-KONAMI.length);

      const isCode =
        recent.length === KONAMI.length && recent.every((key, index) => key === KONAMI[index]);
      if (!isCode) {
        return;
      }

      recent = [];
      if (!isRunning && !prefersReducedMotion()) {
        start();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      timers.forEach((timer) => window.clearTimeout(timer));
      setRun(undefined);
    };
  }, [isEnabled]);

  const state = useMemo(() => ({ run, isEnabled }), [run, isEnabled]);

  return <DominoContext.Provider value={state}>{children}</DominoContext.Provider>;
}
