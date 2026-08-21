import { describe, expect, it, vi } from "vitest";

import { loginLocal } from "./login.js";

describe("local login", () => {
  it("selects the session token independently of Set-Cookie order", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: [
            ["set-cookie", "better-auth.session_data=cached; Path=/; HttpOnly"],
            ["set-cookie", "better-auth.session_token=signed; Path=/; HttpOnly"],
          ],
        }),
      );
    const writes: string[] = [];

    await expect(
      loginLocal("seed@openjii.local", {
        root: "/repo",
        env: { DATABASE_URL: "postgres://localhost/openjii" },
        request,
        readOtp: () => Promise.resolve("123456"),
        write: (text) => writes.push(text),
      }),
    ).resolves.toBe("better-auth.session_token=signed");

    expect(request).toHaveBeenCalledTimes(2);
    expect(writes).toEqual(["better-auth.session_token=signed\n"]);
  });

  it("aborts an authentication request that exceeds its deadline", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("request aborted")), {
          once: true,
        });
      });
    });

    await expect(
      loginLocal("seed@openjii.local", {
        root: "/repo",
        env: { DATABASE_URL: "postgres://localhost/openjii" },
        request,
        requestTimeoutMs: 1,
        readOtp: () => Promise.resolve("123456"),
        write: () => undefined,
      }),
    ).rejects.toThrow(
      "Authentication request timed out after 1 ms: " +
        "http://127.0.0.1:3020/api/v1/auth/email-otp/send-verification-otp",
    );

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
