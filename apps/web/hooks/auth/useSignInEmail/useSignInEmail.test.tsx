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
  ["en-US", 1, "Too many attempts. Try again in 1 second."],
  ["en-US", 59, "Too many attempts. Try again in 59 seconds."],
  ["en-US", 60, "Too many attempts. Try again in 1 minute."],
  ["en-US", 61, "Too many attempts. Try again in 2 minutes."],
  ["en-US", 900, "Too many attempts. Try again in 15 minutes."],
  ["nl-NL", 1, "Te veel pogingen. Probeer het over 1 seconde opnieuw."],
  ["nl-NL", 59, "Te veel pogingen. Probeer het over 59 seconden opnieuw."],
  ["nl-NL", 60, "Te veel pogingen. Probeer het over 1 minuut opnieuw."],
  ["nl-NL", 61, "Te veel pogingen. Probeer het over 2 minuten opnieuw."],
  ["nl-NL", 900, "Te veel pogingen. Probeer het over 15 minuten opnieuw."],
])("translates a real retry header in %s at %s seconds", async (locale, seconds, message) => {
  await translations.changeLanguage(locale);
  vi.mocked(authClient.emailOtp.sendVerificationOtp).mockImplementation(async (_body, options) => {
    await options?.onError?.({
      response: new Response(null, { status: 429, headers: { "Retry-After": String(seconds) } }),
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
