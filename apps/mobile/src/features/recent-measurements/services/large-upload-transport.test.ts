import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LargeUploadError } from "./large-upload-errors";
import { createLargeUploadTransport } from "./large-upload-transport";

const { mockGetUploadUrl } = vi.hoisted(() => ({ mockGetUploadUrl: vi.fn() }));

vi.mock("~/shared/api/client", () => ({
  getApiClient: () => ({ iot: { getUploadUrl: mockGetUploadUrl } }),
}));

vi.mock("~/shared/stores/device-identity-store", () => ({
  getLocalThingName: () => "mobile_thing",
}));
vi.mock("expo-application", () => ({ nativeApplicationVersion: "2.4.1" }));

const EXPERIMENT_ID = "11111111-1111-1111-1111-111111111111";
const TOPIC = `experiment/data_ingest/v1/${EXPERIMENT_ID}/mobile/2.4.1/mobile_thing`;

const target = { uploadUrl: "https://bucket.example/put", key: "large-iot/e/1.json" };

function response(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

// Seeded with a real implementation so the mock's type carries the Response
// promise; an untyped vi.fn() infers a void return and rejects mockImplementation.
function createFetchMock() {
  return vi.fn(
    (_url: string, _init: RequestInit): Promise<Response> => Promise.resolve(response(200)),
  );
}

let fetchMock: ReturnType<typeof createFetchMock>;

beforeEach(() => {
  mockGetUploadUrl.mockReset();
  fetchMock = createFetchMock();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("largeUploadTransport", () => {
  it("mints a URL for the topic's experiment and PUTs the payload", async () => {
    mockGetUploadUrl.mockResolvedValue(target);
    fetchMock.mockResolvedValue(response(200));

    await createLargeUploadTransport().publish(TOPIC, { v: 1 });

    expect(mockGetUploadUrl).toHaveBeenCalledWith({ experimentId: EXPERIMENT_ID });
    expect(fetchMock).toHaveBeenCalledWith(target.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ v: 1 }),
      signal: expect.any(AbortSignal),
    });
  });

  it("refuses a topic with no experiment id, without retrying", async () => {
    const error = await createLargeUploadTransport()
      .publish("nonsense/topic", { v: 1 })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(LargeUploadError);
    expect(error).toMatchObject({ kind: "NoExperiment", retryable: false });
    expect(mockGetUploadUrl).not.toHaveBeenCalled();
  });

  it("treats a refused membership as terminal", async () => {
    mockGetUploadUrl.mockRejectedValue({ status: 403 });

    const error = await createLargeUploadTransport()
      .publish(TOPIC, { v: 1 })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ kind: "Forbidden", retryable: false });
  });

  it("treats a missing experiment as terminal", async () => {
    mockGetUploadUrl.mockRejectedValue({ status: 404 });

    const error = await createLargeUploadTransport()
      .publish(TOPIC, { v: 1 })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ kind: "NotFound", retryable: false });
  });

  it("treats an unreachable backend as retryable", async () => {
    mockGetUploadUrl.mockRejectedValue(new Error("network down"));

    const error = await createLargeUploadTransport()
      .publish(TOPIC, { v: 1 })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ kind: "Network", retryable: true });
  });

  it("mints a fresh URL once when S3 rejects an expired signature", async () => {
    mockGetUploadUrl.mockResolvedValue(target);
    fetchMock.mockResolvedValueOnce(response(403)).mockResolvedValueOnce(response(200));

    await createLargeUploadTransport().publish(TOPIC, { v: 1 });

    expect(mockGetUploadUrl).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up when the refreshed URL is refused too", async () => {
    mockGetUploadUrl.mockResolvedValue(target);
    fetchMock.mockResolvedValue(response(403));

    const error = await createLargeUploadTransport()
      .publish(TOPIC, { v: 1 })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ kind: "Rejected", retryable: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats an S3 server error as retryable", async () => {
    mockGetUploadUrl.mockResolvedValue(target);
    fetchMock.mockResolvedValue(response(503));

    const error = await createLargeUploadTransport()
      .publish(TOPIC, { v: 1 })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ kind: "Rejected", retryable: true });
  });

  it("treats a dropped PUT as retryable", async () => {
    mockGetUploadUrl.mockResolvedValue(target);
    fetchMock.mockRejectedValue(new Error("socket hang up"));

    const error = await createLargeUploadTransport()
      .publish(TOPIC, { v: 1 })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ kind: "Network", retryable: true });
  });

  it("aborts an in-flight PUT when the transport is destroyed", async () => {
    mockGetUploadUrl.mockResolvedValue(target);
    let abortSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      abortSignal = init.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });

    const transport = createLargeUploadTransport();
    const pending = transport.publish(TOPIC, { v: 1 }).catch((err: unknown) => err);
    await Promise.resolve();
    await Promise.resolve();
    transport.destroy();

    expect(abortSignal?.aborted).toBe(true);
    expect(await pending).toMatchObject({ kind: "Network", retryable: true });
  });

  it("stops accepting work once destroyed", async () => {
    const transport = createLargeUploadTransport();
    transport.destroy();

    const error = await transport.publish(TOPIC, { v: 1 }).catch((err: unknown) => err);

    expect(error).toMatchObject({ retryable: false });
    expect(mockGetUploadUrl).not.toHaveBeenCalled();
  });
});
