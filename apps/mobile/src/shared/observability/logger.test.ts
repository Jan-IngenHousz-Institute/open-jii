import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addLogSink,
  clearLogSinks,
  createLogger,
  setMinLogLevel,
} from "~/shared/observability/logger";
import type { LogEntry } from "~/shared/observability/logger";

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

describe("logger", () => {
  let removeSink: (() => void) | null = null;

  beforeEach(() => {
    clearLogSinks();
    setMinLogLevel("debug");
  });

  afterEach(() => {
    removeSink?.();
    removeSink = null;
    clearLogSinks();
    setMinLogLevel("debug");
  });

  it("routes entries through registered sinks with namespace + fields", () => {
    const { entries, sink } = captureSink();
    removeSink = addLogSink(sink);

    const log = createLogger("upload-worker");
    log.info("publish start", { id: "row-1", topic: "t/a" });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: "info",
      ns: "upload-worker",
      msg: "publish start",
      fields: { id: "row-1", topic: "t/a" },
    });
    expect(typeof entries[0].ts).toBe("number");
  });

  it("respects min log level", () => {
    const { entries, sink } = captureSink();
    removeSink = addLogSink(sink);
    setMinLogLevel("warn");

    const log = createLogger("ns");
    log.debug("a");
    log.info("b");
    log.warn("c");
    log.error("d");

    expect(entries.map((e) => e.msg)).toEqual(["c", "d"]);
  });

  it("child loggers merge base fields with per-call fields", () => {
    const { entries, sink } = captureSink();
    removeSink = addLogSink(sink);

    const root = createLogger("mqtt", { slot: 2 });
    const child = root.child({ topic: "t/a" });
    child.info("publish", { id: 7 });

    expect(entries[0].fields).toEqual({ slot: 2, topic: "t/a", id: 7 });
  });

  it("a throwing sink does not break other sinks or callers", () => {
    const good = captureSink();
    const removeBad = addLogSink({
      write() {
        throw new Error("boom");
      },
    });
    removeSink = addLogSink(good.sink);

    const log = createLogger("ns");
    expect(() => log.info("ok")).not.toThrow();
    expect(good.entries).toHaveLength(1);

    removeBad();
  });
});
