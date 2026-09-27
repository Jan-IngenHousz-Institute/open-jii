import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettledItem } from "~/features/recent-measurements/services/outbox";
import { trackProductEvent } from "~/shared/observability/product-events";

import { mountUploadAnalytics } from "./upload-analytics";

vi.mock("~/shared/observability/product-events", () => ({ trackProductEvent: vi.fn() }));

let deliver: (items: readonly SettledItem[]) => void = () => undefined;
const unsubscribe = vi.fn();
const outbox = {
  subscribeSettled: (listener: (items: readonly SettledItem[]) => void) => {
    deliver = listener;
    return unsubscribe;
  },
};

beforeEach(() => {
  vi.mocked(trackProductEvent).mockClear();
});

describe("mountUploadAnalytics", () => {
  it("counts each settled upload with its route, and why a failure failed", () => {
    mountUploadAnalytics(outbox);

    deliver([
      { id: "a", status: "successful", route: "mqtt" },
      { id: "b", status: "failed", reason: "payload_limit", route: "mqtt", stage: "terminal" },
      { id: "c", status: "failed", stage: "retries_exhausted" },
    ]);

    expect(vi.mocked(trackProductEvent).mock.calls).toEqual([
      ["measurement:upload_succeed", { route: "mqtt" }],
      ["measurement:upload_fail", { reason: "payload_limit", stage: "terminal", route: "mqtt" }],
      [
        "measurement:upload_fail",
        { reason: "unknown", stage: "retries_exhausted", route: "unknown" },
      ],
    ]);
  });

  it("stops listening when unmounted", () => {
    mountUploadAnalytics(outbox)();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
