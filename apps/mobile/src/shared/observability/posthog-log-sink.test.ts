import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPostHogLogSink } from "./posthog-log-sink";

const client = { captureLog: vi.fn(), captureException: vi.fn() };
const sink = createPostHogLogSink(client, () => "prod");

function entry(level: "info" | "warn" | "error", fields: Record<string, unknown> = {}) {
  return { ts: 0, level, ns: "upload", msg: "publish failed", fields };
}

beforeEach(() => {
  client.captureLog.mockClear();
  client.captureException.mockClear();
});

describe("createPostHogLogSink", () => {
  it("ships a line to PostHog Logs with its namespace, environment and scalar fields", () => {
    sink.write(entry("warn", { id: "m-1", attempts: 3, detail: { code: 7 }, gone: undefined }));

    expect(client.captureLog).toHaveBeenCalledWith({
      body: "publish failed",
      level: "warn",
      attributes: {
        id: "m-1",
        attempts: 3,
        detail: '{"code":7}',
        ns: "upload",
        environment: "prod",
      },
    });
    expect(client.captureException).not.toHaveBeenCalled();
  });

  it("reports an error line with the Error it carries, so the stack is the real one", () => {
    const cause = new TypeError("Cannot read property 'kind' of undefined");

    sink.write(entry("error", { err: cause }));

    expect(client.captureException).toHaveBeenCalledWith(cause, {
      err: cause.message,
      ns: "upload",
    });
  });

  it("names an error line without an Error by its message, which then groups it", () => {
    sink.write(entry("error", { err: "Unauthorized" }));

    const [reported, properties] = client.captureException.mock.calls[0] ?? [];
    expect(reported).toEqual(new Error("[upload] publish failed"));
    expect(properties).toMatchObject({
      err: "Unauthorized",
      $exception_fingerprint: "upload:publish failed",
    });
  });

  it("keeps an expected failure a log line when the caller says report: false", () => {
    sink.write(entry("error", { report: false, reason: "device disconnected" }));

    expect(client.captureLog).toHaveBeenCalledWith(
      expect.objectContaining({ attributes: expect.not.objectContaining({ report: false }) }),
    );
    expect(client.captureException).not.toHaveBeenCalled();
  });
});
