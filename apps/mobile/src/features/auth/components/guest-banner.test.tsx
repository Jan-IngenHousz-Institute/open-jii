import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SettledItem } from "~/features/recent-measurements/services/outbox";
import english from "~/shared/i18n/locales/en-US/auth.json";
import dutch from "~/shared/i18n/locales/nl-NL/auth.json";

import { GuestBanner } from "./guest-banner";

const state = vi.hoisted(() => ({
  language: "en-US",
  user: { id: "guest-a", isAnonymous: true, name: "Visitor" },
  online: true,
  counts: vi.fn(),
  ids: vi.fn(),
  logout: vi.fn(),
  enqueue: vi.fn(),
  settle: undefined as undefined | ((items: readonly SettledItem[]) => void),
}));
vi.mock("~/features/auth/hooks/use-session", () => ({ useSession: () => ({ user: state.user }) }));
vi.mock("~/features/auth/hooks/use-logout", () => ({ useLogout: () => state.logout }));
vi.mock("~/shared/db/measurements-storage", () => ({
  countMeasurementsByStatus: state.counts,
  getMeasurementIds: state.ids,
}));
vi.mock("~/shared/ui/hooks/use-is-online", () => ({ useIsOnline: () => ({ data: state.online }) }));
vi.mock("~/shared/composition/upload", () => ({
  getOutbox: () => ({
    enqueueMany: state.enqueue,
    subscribeSettled: (listener: typeof state.settle) => {
      state.settle = listener;
      return () => {
        state.settle = undefined;
      };
    },
  }),
}));
vi.mock("~/shared/i18n", async () => {
  const { createInstance } = await import("i18next");
  const { default: en } = await import("~/shared/i18n/locales/en-US/auth.json");
  const { default: nl } = await import("~/shared/i18n/locales/nl-NL/auth.json");
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
let client: QueryClient;
function show() {
  return render(
    <QueryClientProvider client={client}>
      <GuestBanner />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  state.online = true;
  state.user.isAnonymous = true;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  state.counts.mockResolvedValue({ pending: 1, failed: 0, successful: 8 });
  state.ids.mockResolvedValue(["guest-a-row"]);
  state.logout.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  client.clear();
});

describe.each([
  ["en-US", english],
  ["nl-NL", dutch],
] as const)("guest departure in %s", (language, copy) => {
  beforeEach(() => {
    state.language = language;
  });
  async function warn() {
    show();
    fireEvent.press(screen.getByText(copy.demo.leave));
    await waitFor(() =>
      expect(state.counts).toHaveBeenCalledWith({ userId: "guest-a", isGuest: true }),
    );
    fireEvent.press(screen.getAllByText(copy.demo.leave)[1]);
    await screen.findByText(copy.demo.leaveAnyway);
  }
  it("confirms before warning, and Cancel never leaves or uploads", async () => {
    await warn();
    expect(state.logout).not.toHaveBeenCalled();
    expect(state.enqueue).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText(copy.demo.cancel));
    expect(state.logout).not.toHaveBeenCalled();
  });
  it("Upload now stays signed in through pending and failed uploads", async () => {
    await warn();
    fireEvent.press(screen.getByText(copy.demo.upload));
    await waitFor(() => expect(state.enqueue).toHaveBeenCalledWith(["guest-a-row"]));
    expect(state.ids).toHaveBeenCalledWith(["pending", "failed"], {
      userId: "guest-a",
      isGuest: true,
    });
    expect(screen.getByText(copy.demo.uploading)).toBeTruthy();
    expect(screen.queryByText(copy.demo.uploadError)).toBeNull();
    expect(state.logout).not.toHaveBeenCalled();
    act(() => state.settle?.([{ id: "guest-a-row", status: "failed" }]));
    expect(await screen.findByText(copy.demo.uploadError)).toBeTruthy();
    expect(state.logout).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText(copy.demo.leaveAnyway));
    await waitFor(() => expect(state.logout).toHaveBeenCalledTimes(1));
  });
  it("offline upload is disabled but Leave anyway still clears the session", async () => {
    state.online = false;
    await warn();
    expect(screen.getByText(copy.demo.uploadOffline)).toBeTruthy();
    fireEvent.press(screen.getByText(copy.demo.upload));
    expect(state.enqueue).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText(copy.demo.leaveAnyway));
    await waitFor(() => expect(state.logout).toHaveBeenCalledTimes(1));
  });
  it("rechecks after upload so a newly captured unsent row still requires a warning", async () => {
    await warn();
    fireEvent.press(screen.getByText(copy.demo.upload));
    await waitFor(() => expect(state.enqueue).toHaveBeenCalledOnce());
    state.counts.mockResolvedValue({ pending: 0, failed: 0, successful: 9 });
    act(() => state.settle?.([{ id: "guest-a-row", status: "successful" }]));
    await waitFor(() => expect(screen.queryByText(copy.demo.leaveAnyway)).toBeNull());
    state.counts.mockResolvedValue({ pending: 1, failed: 0, successful: 9 });
    fireEvent.press(screen.getAllByText(copy.demo.leave)[1]);
    await screen.findByText(copy.demo.leaveAnyway);
    expect(state.logout).not.toHaveBeenCalled();
  });
  it("leaves after confirmation when all own measurements are already uploaded", async () => {
    state.counts.mockResolvedValue({ pending: 0, failed: 0, successful: 9 });
    show();
    fireEvent.press(screen.getByText(copy.demo.leave));
    await waitFor(() => expect(state.counts).toHaveBeenCalled());
    fireEvent.press(screen.getAllByText(copy.demo.leave)[1]);
    await waitFor(() => expect(state.logout).toHaveBeenCalledOnce());
    expect(state.enqueue).not.toHaveBeenCalled();
  });
  it("says the unsent check failed, not that uploads failed, when the count cannot be read", async () => {
    show();
    fireEvent.press(screen.getByText(copy.demo.leave));
    await waitFor(() => expect(state.counts).toHaveBeenCalled());
    state.counts.mockRejectedValue(new Error("database locked"));
    fireEvent.press(screen.getAllByText(copy.demo.leave)[1]);
    expect(await screen.findByText(copy.demo.leaveCheckError)).toBeTruthy();
    expect(screen.queryByText(copy.demo.uploadError)).toBeNull();
    expect(state.logout).not.toHaveBeenCalled();
  });
  it("is absent for a researcher", () => {
    state.user.isAnonymous = false;
    show();
    expect(screen.queryByText(copy.demo.leave)).toBeNull();
  });
});
