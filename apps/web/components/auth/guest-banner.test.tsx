import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as I18nModule from "@repo/i18n";
import english from "@repo/i18n/locales/en-US/common.json";
import dutch from "@repo/i18n/locales/nl-NL/common.json";

import { GuestBanner } from "./guest-banner";

const state = vi.hoisted(() => ({ language: "en-US", signOut: vi.fn() }));
vi.mock("@repo/auth/client", () => ({ authClient: { signOut: state.signOut } }));
vi.mock("@repo/i18n", async () => {
  const { createInstance } = await vi.importActual<typeof I18nModule>("@repo/i18n");
  const { default: en } = await import("@repo/i18n/locales/en-US/common.json");
  const { default: nl } = await import("@repo/i18n/locales/nl-NL/common.json");
  const instance = createInstance();
  await instance.init({
    resources: { "en-US": { translation: en }, "nl-NL": { translation: nl } },
  });
  return {
    useTranslation: () => ({
      t: (key: string, options?: object) => instance.t(key, { ...options, lng: state.language }),
    }),
  };
});

describe.each([
  ["en-US", english],
  ["nl-NL", dutch],
] as const)("guest leave in %s", (locale, copy) => {
  beforeEach(() => {
    state.language = locale;
    state.signOut.mockReset();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });
  it("keeps the current guest and cache after failure, then clears only after successful retry", async () => {
    state.signOut
      .mockResolvedValueOnce({ error: { message: "raw server error" } })
      .mockResolvedValueOnce({ error: null });
    const client = new QueryClient();
    client.setQueryData(["guest-result"], "Saved demo output");
    render(
      <QueryClientProvider client={client}>
        <GuestBanner name="Visitor" locale={locale} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: copy.demo.leave }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: copy.demo.leave }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.demo.leaveError);
    expect(screen.getByRole("complementary", { hidden: true })).toHaveTextContent("Visitor");
    expect(client.getQueryData(["guest-result"])).toBe("Saved demo output");
    expect(screen.queryByText("raw server error")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.demo.retry }));
    await waitFor(() => expect(client.getQueryData(["guest-result"])).toBeUndefined());
    expect(state.signOut).toHaveBeenCalledTimes(2);
  });
  it("offline and Cancel leave the guest data untouched", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const client = new QueryClient();
    client.setQueryData(["guest-result"], "result");
    render(
      <QueryClientProvider client={client}>
        <GuestBanner name="Visitor" locale={locale} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: copy.demo.leave }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: copy.demo.leave }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.demo.leaveError);
    fireEvent.click(screen.getByRole("button", { name: copy.demo.cancel }));
    expect(state.signOut).not.toHaveBeenCalled();
    expect(client.getQueryData(["guest-result"])).toBe("result");
  });
});
