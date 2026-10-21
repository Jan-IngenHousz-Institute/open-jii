import { renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useSignInEmail } from "./useSignInEmail";

describe("useSignInEmail", () => {
  it("calls sendVerificationOtp with email", async () => {
    vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const { result } = renderHook(() => useSignInEmail());
    await result.current.mutateAsync("test@example.com");

    expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledWith(
      {
        email: "test@example.com",
        type: "sign-in",
      },
      expect.anything(),
    );
  });
});

const { createInstance } = await vi.importActual<typeof import("@repo/i18n")>("@repo/i18n");
const translations = createInstance();
const en = await import("@repo/i18n/locales/en-US/common.json");
const nl = await import("@repo/i18n/locales/nl-NL/common.json");
await translations.init({
  lng: "en-US",
  defaultNS: "common",
  resources: {
    "en-US": { common: en.default },
    "nl-NL": { common: nl.default },
  },
});
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({ t: translations.t.bind(translations) }),
}));

it.each([
  ["en-US", "Too many attempts. Try again in 900 seconds."],
  ["nl-NL", "Te veel pogingen. Probeer het over 900 seconden opnieuw."],
])("translates a real retry header in %s", async (locale, message) => {
  await translations.changeLanguage(locale);
  vi.mocked(authClient.emailOtp.sendVerificationOtp).mockImplementation(async (_body, options) => {
    await options?.onError?.({
      response: new Response(null, { status: 429, headers: { "Retry-After": "900" } }),
    } as Parameters<NonNullable<NonNullable<typeof options>["onError"]>>[0]);
    return {
      data: null,
      error: { status: 429, statusText: "Too Many Requests", message: "server message" },
    };
  });
  const { result } = renderHook(() => useSignInEmail());
  const response = await result.current.mutateAsync("quota@example.test");
  expect(response.error?.message).toBe(message);
});
