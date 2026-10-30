import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking, Modal } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import english from "~/shared/i18n/locales/en-US/auth.json";
import dutch from "~/shared/i18n/locales/nl-NL/auth.json";
import { Button } from "~/shared/ui/Button";

import { TryDemo } from "./try-demo";

const state = vi.hoisted(() => ({
  language: "en-US",
  available: vi.fn(),
  session: vi.fn(),
  create: vi.fn(),
  accept: vi.fn(),
}));
vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    users: {
      getDemoAvailability: {
        queryOptions: (options: object) => ({
          queryKey: ["availability"],
          queryFn: state.available,
          ...options,
        }),
      },
    },
  },
}));
vi.mock("~/features/auth/services/auth", () => ({
  getAuthClient: () => ({ getSession: state.session, $fetch: state.create }),
}));
vi.mock("~/features/auth/services/session-cache", () => ({ acceptNewSession: state.accept }));
vi.mock("~/shared/stores/environment-store", () => ({ getEnvVar: () => "https://example.test" }));
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
async function readyEntry(label: string) {
  await waitFor(() => expect(client.getQueryData(["availability"])).toEqual({ enabled: true }));
  return screen.getByText(label);
}
function show(online: boolean | undefined = true) {
  return render(
    <QueryClientProvider client={client}>
      <TryDemo online={online} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.clearAllMocks();
  state.language = "en-US";
  state.available.mockResolvedValue({ enabled: true });
  state.session.mockResolvedValue({ data: null, error: null });
  state.create.mockResolvedValue({ data: { user: { id: "new-guest" } }, error: null });
});
afterEach(() => {
  cleanup();
  client.clear();
});

describe.each([
  ["en-US", english],
  ["nl-NL", dutch],
] as const)("demo entry in %s", (language, copy) => {
  beforeEach(() => {
    state.language = language;
  });
  it("does not create a guest before confirmation and preserves the name on retry", async () => {
    show();
    fireEvent.press(await readyEntry(copy.demo.try));
    expect(screen.getByText(copy.demo.permanent)).toBeTruthy();
    expect(screen.getByText(copy.demo.nameHint)).toBeTruthy();
    if (language === "en-US") {
      expect(copy.demo.permanent).toContain("location");
      expect(copy.demo.permanent).toContain("Former guest");
      expect(copy.demo.nameHint).toContain("real name");
    } else {
      expect(copy.demo.permanent).toContain("locatie");
      expect(copy.demo.permanent).toContain("Voormalige gast");
      expect(copy.demo.nameHint).toContain("echte naam");
    }
    expect(screen.getByText(copy.demo.terms)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText(copy.demo.name), "River");
    fireEvent.press(screen.getByText(copy.demo.cancel));
    expect(state.create).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText(copy.demo.try));
    state.create.mockResolvedValueOnce({
      data: null,
      error: { status: 403, code: "DEMO_DISABLED" },
    });
    fireEvent.press(screen.getByText(copy.demo.continue));
    expect(await screen.findByText(copy.demo.unavailable)).toBeTruthy();
    expect(screen.getByDisplayValue("River")).toBeTruthy();
    expect(state.accept).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText(copy.demo.continue));
    await waitFor(() => expect(state.accept).toHaveBeenCalledWith("new-guest"));
  });
  it("translates rate limits and keeps the dialog retryable", async () => {
    state.create.mockResolvedValue({ data: null, error: { status: 429 } });
    show();
    fireEvent.press(await readyEntry(copy.demo.try));
    fireEvent.press(screen.getByText(copy.demo.continue));
    expect(await screen.findByText(copy.demo.entryError_limited)).toBeTruthy();
  });
});
it.each(["", "   ", "River", "Zoë 水", "a".repeat(60), "<b>Guest</b>"])(
  "accepts a nickname as text: %s",
  async (name) => {
    show();
    fireEvent.press(await readyEntry(english.demo.try));
    fireEvent.changeText(screen.getByLabelText(english.demo.name), name);
    fireEvent.press(screen.getByText(english.demo.continue));
    await waitFor(() =>
      expect(state.create).toHaveBeenCalledWith("/sign-in/anonymous", {
        method: "POST",
        body: { name: name.trim() || "Guest" },
      }),
    );
  },
);
it.each(["a".repeat(61), "a@b", "person@example.test", "www.example.test", "https://example.test"])(
  "refuses an invalid nickname: %s",
  async (name) => {
    show();
    fireEvent.press(await readyEntry(english.demo.try));
    fireEvent.changeText(screen.getByLabelText(english.demo.name), name);
    fireEvent.press(screen.getByText(english.demo.continue));
    expect(await screen.findByText(english.demo.invalidName)).toBeTruthy();
    expect(state.create).not.toHaveBeenCalled();
  },
);
it("resumes an existing guest and does not convert an existing researcher", async () => {
  state.session.mockResolvedValueOnce({
    data: { user: { id: "existing-guest", isAnonymous: true } },
    error: null,
  });
  show();
  fireEvent.press(await readyEntry(english.demo.try));
  fireEvent.press(screen.getByText(english.demo.continue));
  await waitFor(() => expect(state.accept).toHaveBeenCalledWith("existing-guest"));
  expect(state.create).not.toHaveBeenCalled();
  state.session.mockResolvedValueOnce({
    data: { user: { id: "researcher", isAnonymous: false } },
    error: null,
  });
  fireEvent.press(screen.getByText(english.demo.continue));
  expect(await screen.findByText(english.demo.entryError)).toBeTruthy();
  expect(state.create).not.toHaveBeenCalled();
});
it("shows a disabled entry on an offline cold launch and after losing connectivity", async () => {
  const view = show(false);
  expect(screen.getByText(english.demo.try)).toBeDisabled();
  expect(screen.getByText(english.demo.offline)).toBeTruthy();
  expect(state.available).not.toHaveBeenCalled();
  view.rerender(
    <QueryClientProvider client={client}>
      <TryDemo online />
    </QueryClientProvider>,
  );
  await readyEntry(english.demo.try);
  view.rerender(
    <QueryClientProvider client={client}>
      <TryDemo online={false} />
    </QueryClientProvider>,
  );
  expect(screen.getByText(english.demo.offline)).toBeTruthy();
  fireEvent.press(screen.getByText(english.demo.try));
  expect(state.create).not.toHaveBeenCalled();
});
it("coalesces confirmation taps while the request is pending", async () => {
  let resolve!: (value: unknown) => void;
  state.create.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  show();
  fireEvent.press(await readyEntry(english.demo.try));
  fireEvent.press(screen.getByText(english.demo.continue));
  fireEvent.press(screen.getByText(english.demo.continue));
  await waitFor(() => expect(state.create).toHaveBeenCalledTimes(1));
  await act(async () => {
    resolve({ data: { user: { id: "new-guest" } }, error: null });
    await Promise.resolve();
  });
  expect(state.accept).toHaveBeenCalledTimes(1);
});
it.each([false, "error"])(
  "hides only known-off availability, otherwise disables entry (%s)",
  async (value) => {
    if (value === "error") state.available.mockRejectedValue(new Error("network"));
    else state.available.mockResolvedValue({ enabled: value });
    show();
    await waitFor(() => expect(client.getQueryState(["availability"])?.fetchStatus).toBe("idle"));
    if (value === false) expect(screen.queryByText(english.demo.try)).toBeNull();
    else {
      expect(screen.getByText(english.demo.try)).toBeDisabled();
      expect(screen.getByText(english.demo.offline)).toBeTruthy();
    }
  },
);
it.each(["missing-id", "session-error", "network", "issuer-failed"])(
  "keeps the entry retryable after %s",
  async (failure) => {
    if (failure === "missing-id")
      state.create.mockResolvedValue({ data: { user: { id: "" } }, error: null });
    if (failure === "session-error")
      state.session.mockResolvedValue({ data: null, error: { message: "expired" } });
    if (failure === "network") state.session.mockRejectedValue(new Error("offline"));
    if (failure === "issuer-failed")
      state.create.mockResolvedValue({ data: null, error: { status: 500 } });
    show();
    fireEvent.press(await readyEntry(english.demo.try));
    fireEvent.press(screen.getByText(english.demo.continue));
    expect(await screen.findByText(english.demo.entryError)).toBeTruthy();
    expect(state.accept).not.toHaveBeenCalled();
  },
);
it("opens terms and dismisses with the Android back action without creating an account", async () => {
  const openUrl = vi.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  const view = show();
  fireEvent.press(await readyEntry(english.demo.try));
  fireEvent.press(screen.getByText(english.demo.terms));
  expect(openUrl).toHaveBeenCalledWith("https://example.test/terms-and-conditions");
  fireEvent(view.UNSAFE_getByType(Modal), "requestClose");
  expect(screen.queryByText(english.demo.title)).toBeNull();
  expect(state.create).not.toHaveBeenCalled();
  openUrl.mockRestore();
});
it("refuses a confirmation queued before connectivity disappears", async () => {
  const view = show();
  fireEvent.press(await readyEntry(english.demo.try));
  const queued = view
    .UNSAFE_getAllByType(Button)
    .find((button) => button.props.title === english.demo.continue)?.props.onPress;
  view.rerender(
    <QueryClientProvider client={client}>
      <TryDemo online={false} />
    </QueryClientProvider>,
  );
  act(() => {
    queued?.();
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(english.demo.offline);
  expect(state.session).not.toHaveBeenCalled();
});
it("keeps unknown connectivity visible and disabled", () => {
  render(
    <QueryClientProvider client={client}>
      <TryDemo online={undefined} />
    </QueryClientProvider>,
  );
  expect(screen.getByText(english.demo.try)).toBeDisabled();
  expect(screen.getByText(english.demo.offline)).toBeTruthy();
  expect(state.available).not.toHaveBeenCalled();
});
