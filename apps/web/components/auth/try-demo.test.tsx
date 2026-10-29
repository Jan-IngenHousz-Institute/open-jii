import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as I18nModule from "@repo/i18n";
import english from "@repo/i18n/locales/en-US/common.json";
import dutch from "@repo/i18n/locales/nl-NL/common.json";

import { TryDemo } from "./try-demo";

const api = vi.hoisted(() => ({
  language: "keys",
  available: vi.fn(),
  session: vi.fn(),
  create: vi.fn(),
  directory: vi.fn(),
}));
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
      t: (key: string, options?: object) => {
        if (api.language === "keys") return key;
        return instance.t(key, { ...options, lng: api.language });
      },
    }),
  };
});
vi.mock("@/lib/orpc", () => ({
  orpc: {
    users: {
      getDemoAvailability: {
        queryOptions: (options: object) => ({
          queryKey: ["availability"],
          queryFn: api.available,
          ...options,
        }),
      },
    },
  },
  orpcClient: { organizations: { listOrganizations: api.directory } },
}));
vi.mock("@repo/auth/client", () => ({
  authClient: { getSession: api.session, $fetch: api.create },
}));
beforeEach(() => {
  vi.clearAllMocks();
  api.language = "keys";
  api.available.mockResolvedValue({ enabled: true });
  api.session.mockResolvedValue({ data: null, error: null });
  api.create.mockResolvedValue({ data: { user: { id: "new-guest" } }, error: null });
  api.directory.mockResolvedValue({ organizations: [] });
});
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TryDemo locale="en-US" />
    </QueryClientProvider>,
  );
  return client;
}
async function open() {
  show();
  fireEvent.click(await screen.findByRole("button", { name: "demo.try" }));
}
it("Cancel and opening the dialog never create a user", async () => {
  await open();
  expect(screen.getByText("demo.permanent")).toBeInTheDocument();
  const terms = screen.getByRole("link", { name: "demo.terms (docsHelp.opensNewTab)" });
  expect(terms).toHaveAttribute("href", "/en-US/terms-and-conditions");
  expect(terms).toHaveAttribute("target", "_blank");
  fireEvent.click(screen.getByRole("button", { name: "demo.cancel" }));
  expect(api.session).not.toHaveBeenCalled();
  expect(api.create).not.toHaveBeenCalled();
});
it("retries a missing directory without creating another guest", async () => {
  await open();
  fireEvent.change(screen.getByLabelText("demo.name"), { target: { value: "River" } });
  fireEvent.click(screen.getByRole("button", { name: "demo.continue" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("demo.noContent");
  expect(api.create).toHaveBeenCalledWith("/sign-in/anonymous", {
    method: "POST",
    body: { name: "River" },
  });
  expect(screen.getByLabelText("demo.name")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "demo.continue" }));
  await waitFor(() => expect(api.directory).toHaveBeenCalledTimes(2));
  expect(api.directory).toHaveBeenCalledWith({ scope: "related" });
  expect(api.create).toHaveBeenCalledTimes(1);
});
it("resumes an existing guest without a new sign-in", async () => {
  api.session.mockResolvedValue({
    data: { user: { id: "existing", isAnonymous: true } },
    error: null,
  });
  await open();
  fireEvent.click(screen.getByRole("button", { name: "demo.continue" }));
  await screen.findByText("demo.noContent");
  expect(api.create).not.toHaveBeenCalled();
  expect(api.directory).toHaveBeenCalledOnce();
});
it("cannot turn an existing researcher into a guest", async () => {
  api.session.mockResolvedValue({
    data: { user: { id: "researcher", isAnonymous: false } },
    error: null,
  });
  await open();
  fireEvent.click(screen.getByRole("button", { name: "demo.continue" }));
  await screen.findByText("demo.entryError");
  expect(api.create).not.toHaveBeenCalled();
  expect(api.directory).not.toHaveBeenCalled();
});
it.each(["", "  ", "Zoë 水", "a".repeat(60), "<b>Guest</b>"])(
  "accepts text nickname %s",
  async (name) => {
    await open();
    fireEvent.change(screen.getByLabelText("demo.name"), { target: { value: name } });
    fireEvent.click(screen.getByRole("button", { name: "demo.continue" }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith("/sign-in/anonymous", {
        method: "POST",
        body: { name: name.trim() || "Guest" },
      }),
    );
  },
);
it.each(["a@b", "person@example.test", "https://example.test", "a".repeat(61)])(
  "refuses invalid nickname %s",
  async (name) => {
    await open();
    fireEvent.change(screen.getByLabelText("demo.name"), { target: { value: name } });
    fireEvent.click(screen.getByRole("button", { name: "demo.continue" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("demo.invalidName");
    const input = screen.getByLabelText("demo.name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(alert.id);
    expect(api.create).not.toHaveBeenCalled();
  },
);

describe.each([
  ["en-US", english, "location", "Former guest", "real name"],
  ["nl-NL", dutch, "locatie", "Voormalige gast", "echte naam"],
] as const)("public guest privacy notice in %s", (locale, copy, location, former, realName) => {
  it("discloses permanent location data and the temporary public nickname before creating an account", async () => {
    api.language = locale;
    show();
    fireEvent.click(await screen.findByRole("button", { name: copy.demo.try }));
    expect(screen.getByText(copy.demo.permanent)).toHaveTextContent(location);
    expect(screen.getByText(copy.demo.permanent)).toHaveTextContent(former);
    expect(screen.getByText(copy.demo.nameHint)).toHaveTextContent(realName);
    expect(api.create).not.toHaveBeenCalled();
  });
});
