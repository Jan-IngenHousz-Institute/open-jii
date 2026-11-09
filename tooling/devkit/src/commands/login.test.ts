import { describe, expect, it, vi } from "vitest";

import { loginLocal } from "./login.js";

const env = { DATABASE_URL: "postgres://localhost/openjii", AUTH_SECRET: "local-secret" };

describe("local login", () => {
  it("reads the code with the backend's auth secret", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: [["set-cookie", "better-auth.session_token=signed; Path=/; HttpOnly"]],
        }),
      );
    const readOtp = vi.fn(() => Promise.resolve("123456"));

    await loginLocal("seed@openjii.local", { root: "/repo", env, request, readOtp });

    expect(readOtp).toHaveBeenCalledWith(
      "postgres://localhost/openjii",
      "seed@openjii.local",
      "local-secret",
    );
  });

  it("refuses to start without an auth secret", async () => {
    const request = vi.fn<typeof fetch>();

    await expect(
      loginLocal("seed@openjii.local", {
        root: "/repo",
        env: { DATABASE_URL: env.DATABASE_URL },
        request,
        readOtp: () => Promise.resolve("123456"),
      }),
    ).rejects.toThrow("AUTH_SECRET is missing from the shell and apps/backend/.env");

    expect(request).not.toHaveBeenCalled();
  });

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
    await expect(
      loginLocal("seed@openjii.local", {
        root: "/repo",
        env,
        request,
        readOtp: () => Promise.resolve("123456"),
      }),
    ).resolves.toBe("better-auth.session_token=signed");

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("sends the web app's origin on every request", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: [["set-cookie", "better-auth.session_token=signed; Path=/; HttpOnly"]],
        }),
      );
    await loginLocal("seed@openjii.local", {
      root: "/repo",
      env,
      request,
      readOtp: () => Promise.resolve("123456"),
    });

    for (const [, init] of request.mock.calls) {
      expect(new Headers(init?.headers).get("origin")).toBe("http://localhost:3000");
    }
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
        env,
        request,
        requestTimeoutMs: 1,
        readOtp: () => Promise.resolve("123456"),
      }),
    ).rejects.toThrow(
      "Authentication request timed out after 1 ms: " +
        "http://127.0.0.1:3020/api/v1/auth/email-otp/send-verification-otp",
    );

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
