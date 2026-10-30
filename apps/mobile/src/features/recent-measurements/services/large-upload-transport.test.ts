import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalUploadIdentity } from "~/features/auth/services/local-upload-identity";

import { LargeUploadError } from "./large-upload-errors";
import { createLargeUploadTransport } from "./large-upload-transport";

const { mockGetUploadUrl } = vi.hoisted(() => ({ mockGetUploadUrl: vi.fn() }));

vi.mock("~/features/auth/services/local-upload-identity", () => ({
  getLocalUploadIdentity: vi.fn(),
}));

vi.mock("~/shared/api/client", () => ({
  getApiClient: () => ({ iot: { getUploadUrl: mockGetUploadUrl } }),
}));

vi.mock("~/shared/stores/device-identity-store", () => ({
  getLocalThingName: () => "mobile_thing",
}));
vi.mock("expo-application", () => ({ nativeApplicationVersion: "2.4.1" }));

const EXPERIMENT_ID = "11111111-1111-1111-1111-111111111111";
const TOPIC = `experiment/data_ingest/v1/${EXPERIMENT_ID}/mobile/2.4.1/mobile_thing`;

const target = { uploadUrl: "https://bucket.example/put", key: "large-iot/e/u/1.json" };

function response(status: number): Response {
  // A real Response rather than a shaped literal, so `ok` is derived the way
  // the transport will see it at runtime.
  return new Response(null, { status });
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
  vi.mocked(getLocalUploadIdentity).mockReturnValue({ userId: "owner", isGuest: false });
  fetchMock = createFetchMock();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("largeUploadTransport", () => {
  it("declares UTF-8 byte length for every guest upload", async () => {
    vi.mocked(getLocalUploadIdentity).mockReturnValue({ userId: "owner", isGuest: true });
    mockGetUploadUrl.mockResolvedValue(target);
    const payload = { value: "é🌱" };
    await createLargeUploadTransport().publish(TOPIC, payload, {
      ownerUserId: "owner",
      guest: true,
    });
    expect(mockGetUploadUrl).toHaveBeenCalledWith({
      experimentId: EXPERIMENT_ID,
      contentLength: new TextEncoder().encode(JSON.stringify(payload)).byteLength,
    });
  });

  it("distinguishes an oversized guest payload from a malformed request", async () => {
    vi.mocked(getLocalUploadIdentity).mockReturnValue({ userId: "owner", isGuest: true });
    mockGetUploadUrl.mockRejectedValue({
      status: 400,
      data: { code: "GUEST_UPLOAD_SIZE_INVALID" },
    });
    await expect(
      createLargeUploadTransport().publish(
        TOPIC,
        { value: 1 },
        { ownerUserId: "owner", guest: true },
      ),
    ).rejects.toMatchObject({ kind: "TooLarge", retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 403, 429])("does not retry a guest issuer refusal %s", async (status) => {
    vi.mocked(getLocalUploadIdentity).mockReturnValue({ userId: "owner", isGuest: true });
    mockGetUploadUrl.mockRejectedValue({ status });
    const error = await createLargeUploadTransport()
      .publish(TOPIC, { value: 1 }, { ownerUserId: "owner", guest: true })
      .catch((error: unknown) => error);
    expect(error).toMatchObject({ retryable: false });
    expect(mockGetUploadUrl).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([403, 413, 429])("does not refresh or retry a guest S3 refusal %s", async (status) => {
    vi.mocked(getLocalUploadIdentity).mockReturnValue({ userId: "owner", isGuest: true });
    mockGetUploadUrl.mockResolvedValue(target);
    fetchMock.mockResolvedValue(response(status));
    const error = await createLargeUploadTransport()
      .publish(TOPIC, { value: 1 }, { ownerUserId: "owner", guest: true })
      .catch((error: unknown) => error);
    expect(error).toMatchObject({ retryable: false });
    expect(mockGetUploadUrl).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a guest server outage retryable", async () => {
    vi.mocked(getLocalUploadIdentity).mockReturnValue({ userId: "owner", isGuest: true });
    mockGetUploadUrl.mockResolvedValue(target);
    fetchMock.mockResolvedValue(response(503));
    const error = await createLargeUploadTransport()
      .publish(TOPIC, { value: 1 }, { ownerUserId: "owner", guest: true })
      .catch((error: unknown) => error);
    expect(error).toMatchObject({ retryable: true });
  });

  it.each([null, { userId: "other", isGuest: false }, { userId: "owner", isGuest: true }])(
    "holds a capture when the current identity differs: %s",
    async (identity) => {
      vi.mocked(getLocalUploadIdentity).mockReturnValue(identity);
      await expect(
        createLargeUploadTransport().publish(TOPIC, { v: 1 }, { ownerUserId: "owner" }),
      ).rejects.toMatchObject({ kind: "IdentityChanged", retryable: false });
      expect(mockGetUploadUrl).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("refuses an upload without capture identity metadata", async () => {
    await expect(createLargeUploadTransport().publish(TOPIC, { v: 1 })).rejects.toMatchObject({
      kind: "IdentityChanged",
    });
    expect(mockGetUploadUrl).not.toHaveBeenCalled();
  });

  it("refuses a target issued while the capture owner signs out", async () => {
    mockGetUploadUrl.mockImplementation(() => {
      vi.mocked(getLocalUploadIdentity).mockReturnValue(null);
      return Promise.resolve(target);
    });
    await expect(
      createLargeUploadTransport().publish(TOPIC, { v: 1 }, { ownerUserId: "owner" }),
    ).rejects.toMatchObject({ kind: "IdentityChanged" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not issue a refreshed key for B when A's pending PUT returns 403", async () => {
    const issuedFor: string[] = [];
    mockGetUploadUrl.mockImplementation(() => {
      issuedFor.push(getLocalUploadIdentity()?.userId ?? "signed-out");
      return Promise.resolve(target);
    });
    let resolvePut: (value: Response) => void = () => undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvePut = resolve;
        }),
    );
    const payload = { user_id: "owner", value: 1 };
    const pending = createLargeUploadTransport()
      .publish(TOPIC, payload, { ownerUserId: "owner" })
      .catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    vi.mocked(getLocalUploadIdentity).mockReturnValue({ userId: "B", isGuest: false });
    resolvePut(response(403));
    expect(await pending).toMatchObject({ kind: "IdentityChanged", retryable: false });
    expect(issuedFor).toEqual(["owner"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1].body).toBe(JSON.stringify(payload));
  });

  it("rejects a refresh target if identity changes while the issuer is pending", async () => {
    mockGetUploadUrl.mockResolvedValueOnce(target).mockImplementationOnce(() => {
      vi.mocked(getLocalUploadIdentity).mockReturnValue({ userId: "B", isGuest: false });
      return Promise.resolve(target);
    });
    fetchMock.mockResolvedValue(response(403));
    await expect(
      createLargeUploadTransport().publish(TOPIC, { v: 1 }, { ownerUserId: "owner" }),
    ).rejects.toMatchObject({ kind: "IdentityChanged" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("mints a URL for the topic's experiment and PUTs the payload", async () => {
    mockGetUploadUrl.mockResolvedValue(target);
    fetchMock.mockResolvedValue(response(200));

    await createLargeUploadTransport().publish(TOPIC, { v: 1 }, { ownerUserId: "owner" });

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
      .publish(TOPIC, { v: 1 }, { ownerUserId: "owner" })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ kind: "Forbidden", retryable: false });
  });

  it("treats a missing experiment as terminal", async () => {
    mockGetUploadUrl.mockRejectedValue({ status: 404 });

    const error = await createLargeUploadTransport()
      .publish(TOPIC, { v: 1 }, { ownerUserId: "owner" })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ kind: "NotFound", retryable: false });
  });

  it("treats a dead session as terminal, since a retry cannot re-authenticate", async () => {
    mockGetUploadUrl.mockRejectedValue({ status: 401 });

    const error = await createLargeUploadTransport()
      .publish(TOPIC, { v: 1 }, { ownerUserId: "owner" })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ kind: "Unauthenticated", retryable: false });
  });

  it("treats a malformed upload-url request as terminal", async () => {
    mockGetUploadUrl.mockRejectedValue({ status: 400 });

    const error = await createLargeUploadTransport()
      .publish(TOPIC, { v: 1 }, { ownerUserId: "owner" })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ kind: "Rejected", retryable: false });
  });

  it("treats an S3 throttle as retryable", async () => {
    mockGetUploadUrl.mockResolvedValue(target);
    fetchMock.mockResolvedValue(response(429));

    const error = await createLargeUploadTransport()
      .publish(TOPIC, { v: 1 }, { ownerUserId: "owner" })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ kind: "Rejected", retryable: true });
  });

  it("treats an unreachable backend as retryable", async () => {
    mockGetUploadUrl.mockRejectedValue(new Error("network down"));

    const error = await createLargeUploadTransport()
      .publish(TOPIC, { v: 1 }, { ownerUserId: "owner" })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ kind: "Network", retryable: true });
  });

  it("mints a fresh URL once when S3 rejects an expired signature", async () => {
    mockGetUploadUrl.mockResolvedValue(target);
    fetchMock.mockResolvedValueOnce(response(403)).mockResolvedValueOnce(response(200));

    await createLargeUploadTransport().publish(TOPIC, { v: 1 }, { ownerUserId: "owner" });

    expect(mockGetUploadUrl).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up when the refreshed URL is refused too", async () => {
    mockGetUploadUrl.mockResolvedValue(target);
    fetchMock.mockResolvedValue(response(403));

    const error = await createLargeUploadTransport()
      .publish(TOPIC, { v: 1 }, { ownerUserId: "owner" })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ kind: "Rejected", retryable: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats an S3 server error as retryable", async () => {
    mockGetUploadUrl.mockResolvedValue(target);
    fetchMock.mockResolvedValue(response(503));

    const error = await createLargeUploadTransport()
      .publish(TOPIC, { v: 1 }, { ownerUserId: "owner" })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ kind: "Rejected", retryable: true });
  });

  it("treats a dropped PUT as retryable", async () => {
    mockGetUploadUrl.mockResolvedValue(target);
    fetchMock.mockRejectedValue(new Error("socket hang up"));

    const error = await createLargeUploadTransport()
      .publish(TOPIC, { v: 1 }, { ownerUserId: "owner" })
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
    const pending = transport
      .publish(TOPIC, { v: 1 }, { ownerUserId: "owner" })
      .catch((err: unknown) => err);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    transport.destroy();

    expect(abortSignal?.aborted).toBe(true);
    expect(await pending).toMatchObject({ kind: "Network", retryable: true });
  });

  it("stops accepting work once destroyed", async () => {
    const transport = createLargeUploadTransport();
    transport.destroy();

    const error = await transport
      .publish(TOPIC, { v: 1 }, { ownerUserId: "owner" })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ retryable: false });
    expect(mockGetUploadUrl).not.toHaveBeenCalled();
  });
});
