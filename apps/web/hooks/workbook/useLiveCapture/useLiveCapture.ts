"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { parseScalarReading } from "./parse-scalar-reading";

export interface LiveCapturePoint {
  /** Seconds since capture started. */
  t: number;
  value: number;
}

interface UseLiveCaptureOptions {
  /** One device round-trip returning the (already parsed) reply. */
  read: () => Promise<unknown>;
  /** Delay between a settled read and the next one. */
  intervalMs?: number;
  /** Rolling window; the oldest points drop beyond this. */
  maxPoints?: number;
}

const DEFAULT_INTERVAL_MS = 1000;
// ~30 minutes at 1 Hz; bounds memory and keeps the SVG line cheap to redraw.
const DEFAULT_MAX_POINTS = 1800;
// A dead device (unplugged, wedged) fails every tick; stop the loop instead
// of surfacing a fresh error once a second forever.
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Self-scheduling read loop for a workbook cell's live capture. The next tick
 * is armed only after the previous read settles, so a read that overruns the
 * interval never stacks a second command onto the driver's serial queue.
 *
 * All captured data is ephemeral component state: it never enters the
 * workbook's cells array, so a running capture cannot trigger draft autosave
 * or re-render other cells.
 */
export function useLiveCapture({
  read,
  intervalMs = DEFAULT_INTERVAL_MS,
  maxPoints = DEFAULT_MAX_POINTS,
}: UseLiveCaptureOptions) {
  const [points, setPoints] = useState<LiveCapturePoint[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Total appended samples; diverges from points.length once the window rolls.
  const [sampleCount, setSampleCount] = useState(0);

  const runningRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(0);
  const consecutiveErrorsRef = useRef(0);

  const readRef = useRef(read);
  readRef.current = read;
  const intervalRef = useRef(intervalMs);
  intervalRef.current = intervalMs;
  const maxPointsRef = useRef(maxPoints);
  maxPointsRef.current = maxPoints;

  const stop = useCallback(() => {
    runningRef.current = false;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  // Extracted so TS does not narrow runningRef.current across awaits; stop()
  // can flip it while a read is in flight.
  const stillRunning = () => runningRef.current;

  const tick = useCallback(async () => {
    if (!stillRunning()) return;
    try {
      const raw = await readRef.current();
      // Stopped while the read was in flight: drop the result.
      if (!stillRunning()) return;
      const value = parseScalarReading(raw);
      if (value === null) {
        setError("Non-numeric reading");
      } else {
        consecutiveErrorsRef.current = 0;
        setError(null);
        const t = (Date.now() - startedAtRef.current) / 1000;
        setSampleCount((n) => n + 1);
        setPoints((prev) => {
          const next = [...prev, { t, value }];
          const max = maxPointsRef.current;
          return next.length > max ? next.slice(next.length - max) : next;
        });
      }
    } catch (err) {
      if (!stillRunning()) return;
      consecutiveErrorsRef.current += 1;
      setError(err instanceof Error ? err.message : "Read failed");
      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
        stop();
      }
    } finally {
      // stop() (button, auto-stop, unmount) flips runningRef, so a stopped
      // loop never re-arms even though this finally always runs.
      if (stillRunning()) {
        timerRef.current = setTimeout(() => void tick(), intervalRef.current);
      }
    }
  }, [stop]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    consecutiveErrorsRef.current = 0;
    startedAtRef.current = Date.now();
    setPoints([]);
    setSampleCount(0);
    setError(null);
    setIsCapturing(true);
    // First read immediately; every later one self-schedules.
    void tick();
  }, [tick]);

  const clear = useCallback(() => {
    setPoints([]);
    setSampleCount(0);
    setError(null);
  }, []);

  // Cell delete / page navigation unmounts the cell; stop the loop with it.
  useEffect(() => () => stop(), [stop]);

  return { points, isCapturing, error, sampleCount, start, stop, clear };
}
