import { beforeEach, describe, expect, it, vi } from "vitest";

import { isOnline } from "../is-online";

const { mockHead } = vi.hoisted(() => ({ mockHead: vi.fn() }));

vi.mock("axios", () => ({
  default: { head: mockHead },
}));

vi.mock("~/shared/stores/environment-store", () => ({
  getEnvVar: (k: string) => (k === "BACKEND_URI" ? "https://api.test/" : ""),
}));

describe("isOnline", () => {
  beforeEach(() => {
    mockHead.mockReset();
  });

  it("targets BACKEND_URI with a HEAD probe", async () => {
    mockHead.mockResolvedValueOnce({ status: 200 });

    expect(await isOnline()).toBe(true);
    expect(mockHead).toHaveBeenCalledWith(
      "https://api.test/",
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it("treats any HTTP response as online (incl. 404 on the bare root)", async () => {
    mockHead.mockResolvedValueOnce({ status: 404 });

    expect(await isOnline()).toBe(true);
  });

  it("passes validateStatus that accepts every status code", async () => {
    mockHead.mockResolvedValueOnce({ status: 500 });

    await isOnline();
    const opts = mockHead.mock.calls[0][1] as { validateStatus: (s: number) => boolean };
    expect(opts.validateStatus(200)).toBe(true);
    expect(opts.validateStatus(404)).toBe(true);
    expect(opts.validateStatus(500)).toBe(true);
  });

  it("returns false when the probe rejects (network failure / timeout)", async () => {
    mockHead.mockRejectedValueOnce(new Error("ECONNABORTED"));

    expect(await isOnline()).toBe(false);
  });
});
