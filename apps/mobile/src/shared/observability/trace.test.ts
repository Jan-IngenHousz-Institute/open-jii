import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addLogSink, clearLogSinks, setMinLogLevel } from "~/shared/observability/logger";
import type { LogEntry } from "~/shared/observability/logger";
import { clearTraceRegistry, getTrace, startTrace } from "~/shared/observability/trace";

function captureSink() {
  const entries: LogEntry[] = [];
  return {
    entries,
    sink: {
      write(entry: LogEntry) {
        entries.push(entry);
      },
    },
  };
}

describe("trace", () => {
  let removeSink: (() => void) | null = null;

  beforeEach(() => {
    clearLogSinks();
    clearTraceRegistry();
    setMinLogLevel("debug");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T10:00:00.000Z"));
  });

  afterEach(() => {
    removeSink?.();
    removeSink = null;
    clearLogSinks();
    clearTraceRegistry();
    vi.useRealTimers();
  });

  it("emits one wide event on end with all collected events and timings", () => {
    const { entries, sink } = captureSink();
    removeSink = addLogSink(sink);

    const t = startTrace("upload", "m_8f7a", { topic: "t/a" });
    vi.advanceTimersByTime(3);
    t.event("pickup", { row_age_ms: 12 });
    vi.advanceTimersByTime(5);
    t.event("publisher_enqueued", { held: 2 });
    vi.advanceTimersByTime(400);
    t.end("ok", { attempts: 1, bytes: 18472 });

    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry.ns).toBe("trace");
    expect(entry.msg).toBe("upload");
    expect(entry.level).toBe("info");
    expect(entry.fields).toMatchObject({
      id: "m_8f7a",
      status: "ok",
      total_ms: 408,
      topic: "t/a",
      attempts: 1,
      bytes: 18472,
    });
    const events = entry.fields.events as string[];
    expect(events).toEqual(["pickup+3(row_age_ms=12)", "publisher_enqueued+8(held=2)"]);
  });

  it("getTrace lets a remote module attach events to the same trace", () => {
    const { entries, sink } = captureSink();
    removeSink = addLogSink(sink);

    startTrace("upload", "m_x");
    // Simulate publisher.ts adding events without holding the Trace handle.
    getTrace("m_x")?.event("slot_acquired", { slot: 2 });
    getTrace("m_x")?.end("ok");

    const events = entries[0].fields.events as string[];
    expect(events).toEqual(["slot_acquired+0(slot=2)"]);
    expect(getTrace("m_x")).toBeUndefined();
  });

  it("re-starting an open trace reuses it (handles retry re-entry)", () => {
    const { entries, sink } = captureSink();
    removeSink = addLogSink(sink);

    const t1 = startTrace("upload", "m_y");
    t1.event("attempt_1_failed");
    const t2 = startTrace("upload", "m_y", { retried: true });
    t2.event("attempt_2_ok");
    t2.end("ok");

    expect(t1).toBe(t2);
    const events = entries[0].fields.events as string[];
    expect(events).toEqual(["attempt_1_failed+0", "attempt_2_ok+0"]);
    expect(entries[0].fields.retried).toBe(true);
  });

  it("end emits at error level when status is error", () => {
    const { entries, sink } = captureSink();
    removeSink = addLogSink(sink);

    const t = startTrace("upload", "m_e");
    t.end("error", { err: "boom" });

    expect(entries[0].level).toBe("error");
    expect(entries[0].fields.status).toBe("error");
    expect(entries[0].fields.err).toBe("boom");
  });
});
