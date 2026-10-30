import { afterEach, describe, expect, it, vi } from "vitest";
import { getLocalUploadIdentity } from "~/features/auth/services/local-upload-identity";
import { createPahoSessionFactory } from "~/features/connection/services/mqtt/mqtt-paho-session";
import { createOutbox } from "~/features/recent-measurements/services/outbox";

import { getOutbox } from "./upload";

const { mqtt, s3, outbox } = vi.hoisted(() => ({
  mqtt: { publish: vi.fn(), destroy: vi.fn() },
  s3: { publish: vi.fn(), destroy: vi.fn() },
  outbox: { enqueue: vi.fn(), destroy: vi.fn() },
}));
vi.mock("~/features/auth/services/local-upload-identity", () => ({
  getLocalUploadIdentity: vi.fn(),
}));
vi.mock("~/features/connection/services/mqtt/mqtt-paho-session", () => ({
  createPahoSessionFactory: vi.fn(),
}));
vi.mock("~/features/connection/services/mqtt/mqtt-transport", () => ({
  createTransport: () => mqtt,
}));
vi.mock("~/features/recent-measurements/services/large-upload-transport", () => ({
  createLargeUploadTransport: () => s3,
}));
vi.mock("~/features/recent-measurements/services/outbox", () => ({
  createOutbox: vi.fn(() => outbox),
}));

vi.unmock("~/shared/composition/upload");

afterEach(() => vi.unstubAllGlobals());

describe("upload composition", () => {
  it("shares one queue across reloads and binds it to the local capture identity", async () => {
    vi.stubGlobal("__openJiiUploadGraph__", undefined);
    expect(getOutbox()).toBe(outbox);
    expect(createOutbox).toHaveBeenCalledWith({
      transport: mqtt,
      largeTransport: s3,
      getIdentity: getLocalUploadIdentity,
    });
    vi.resetModules();
    expect((await import("./upload")).getOutbox()).toBe(outbox);
    expect(createPahoSessionFactory).toHaveBeenCalledTimes(1);
    expect(createOutbox).toHaveBeenCalledTimes(1);
  });
});
