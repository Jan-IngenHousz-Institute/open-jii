import { createSession } from "@/test/factories";
import { createTestQueryClient } from "@/test/test-utils";
import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { waitForCurrentSession } from "./is-current-session";

describe("waitForCurrentSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(authClient.getSession).mockResolvedValue({ data: null, error: null });
    onlineManager.setOnline(true);
  });

  it("waits for a reconnect in browsers without Promise.withResolvers", async () => {
    vi.spyOn(Promise, "withResolvers").mockImplementation(() => {
      throw new TypeError("Promise.withResolvers is not a function");
    });
    const session = createSession();
    vi.mocked(authClient.getSession)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ data: session, error: null });
    onlineManager.setOnline(false);

    const verified = waitForCurrentSession(
      createTestQueryClient(),
      session.user.id,
      session.session.id,
    );
    await Promise.resolve();
    onlineManager.setOnline(true);
    await expect(verified).resolves.toBe(true);
    expect(authClient.getSession).toHaveBeenCalledTimes(2);
  });
});
