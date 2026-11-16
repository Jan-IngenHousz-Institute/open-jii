import { orpc } from "@/lib/orpc";
import { createMacroProtocolEntry, createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import {
  act,
  createTestQueryClient,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@/test/test-utils";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { createInstance } from "@repo/i18n/client";
import translations from "@repo/i18n/locales/en-US/macro.json";

import { CompatibleProtocolsCell } from "./macro-protocols-cell";

vi.unmock("@repo/i18n");
vi.unmock("@repo/i18n/client");

const i18n = createInstance();

beforeAll(async () => {
  await i18n.init({
    lng: "en-US",
    resources: { "en-US": { macro: translations } },
    defaultNS: "macro",
    interpolation: { escapeValue: false },
  });
});

function renderCell(count?: number, onClick = vi.fn()) {
  const queryClient = createTestQueryClient();
  const result = render(
    <I18nextProvider i18n={i18n}>
      <div onClick={onClick}>
        <CompatibleProtocolsCell macroId="macro-1" compatibleProtocolCount={count} />
      </div>
    </I18nextProvider>,
    { queryClient },
  );
  return { ...result, queryClient };
}

function mountNames(options: { status?: number; unblock?: Promise<unknown> } = {}) {
  return server.mount(contract.macros.listCompatibleProtocols, {
    body: [createMacroProtocolEntry({ protocol: createProtocol({ name: "Compatible protocol" }) })],
    ...options,
  });
}

describe("CompatibleProtocolsCell", () => {
  it.each([0, undefined])("shows a plain dash without a request for count %s", async (count) => {
    const spy = mountNames();
    const user = userEvent.setup();
    renderCell(count);

    const dash = screen.getByText("–");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    await user.hover(dash);
    await user.click(dash);
    expect(spy.called).toBe(false);
  });

  it.each([
    [1, "1 protocol", "1 compatible protocol, show names"],
    [3, "3 protocols", "3 compatible protocols, show names"],
  ])("shows a count of %s without fetching names", (count, label, accessibleName) => {
    const spy = mountNames();
    renderCell(count);

    const button = screen.getByRole("button", { name: accessibleName });
    expect(button).toHaveTextContent(label);
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("focus-visible:ring-2");
    expect(spy.called).toBe(false);
  });

  it.each(["mouseenter", "focus", "click"])("reveals names on %s", async (event) => {
    const spy = mountNames();
    renderCell(1);
    const button = screen.getByRole("button");

    if (event === "mouseenter") fireEvent.mouseEnter(button);
    if (event === "focus") act(() => button.focus());
    if (event === "click") fireEvent.click(button);

    expect(await screen.findByText("Compatible protocol")).toBeInTheDocument();
    expect(spy.callCount).toBe(1);
    expect(spy.params.id).toBe("macro-1");
  });

  it("keeps names after mouseleave and stops clicks before and after loading", async () => {
    const spy = mountNames();
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderCell(1, onClick);
    const button = screen.getByRole("button");

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    const chip = await screen.findByText("Compatible protocol");
    fireEvent.mouseLeave(button);
    fireEvent.blur(button);
    expect(chip).toBeInTheDocument();
    await user.click(chip);
    expect(onClick).not.toHaveBeenCalled();
    expect(spy.callCount).toBe(1);
  });

  it("uses the revealed chip names as the button's accessible name", async () => {
    server.mount(contract.macros.listCompatibleProtocols, {
      body: [
        createMacroProtocolEntry({ protocol: createProtocol({ name: "First protocol" }) }),
        createMacroProtocolEntry({ protocol: createProtocol({ name: "Second protocol" }) }),
      ],
    });
    renderCell(2);
    const button = screen.getByRole("button", { name: "2 compatible protocols, show names" });

    fireEvent.click(button);

    const chip = await screen.findByText("First protocol");
    expect(button).toHaveAccessibleName("First protocol Second protocol");
    expect(chip).toHaveClass(
      "bg-muted",
      "text-muted-foreground",
      "inline-block",
      "max-w-40",
      "truncate",
      "rounded",
      "px-1.5",
      "py-0.5",
      "text-[11px]",
    );
  });

  it("keeps the count when the loaded list is empty", async () => {
    server.mount(contract.macros.listCompatibleProtocols, { body: [] });
    const { queryClient } = renderCell(1);

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(
        queryClient.getQueryState(
          orpc.macros.listCompatibleProtocols.queryKey({ input: { id: "macro-1" } }),
        )?.status,
      ).toBe("success"),
    );
    expect(
      screen.getByRole("button", { name: "1 compatible protocol, show names" }),
    ).toHaveTextContent("1 protocol");
  });

  it("keeps the count while names load", async () => {
    let release: (() => void) | undefined;
    const unblock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = mountNames({ unblock });
    renderCell(1);

    fireEvent.mouseEnter(screen.getByRole("button"));
    await waitFor(() => expect(spy.called).toBe(true));
    expect(screen.getByRole("button")).toHaveTextContent("1 protocol");
    release?.();
    expect(await screen.findByText("Compatible protocol")).toBeInTheDocument();
  });

  it("keeps the count when names fail to load", async () => {
    mountNames({ status: 500 });
    const { queryClient } = renderCell(1);

    fireEvent.mouseEnter(screen.getByRole("button"));
    await waitFor(() =>
      expect(
        queryClient.getQueryState(
          orpc.macros.listCompatibleProtocols.queryKey({ input: { id: "macro-1" } }),
        )?.status,
      ).toBe("error"),
    );
    expect(screen.getByRole("button")).toHaveTextContent("1 protocol");
    expect(screen.queryByText("Compatible protocol")).not.toBeInTheDocument();
  });

  it("retries the names on click after they failed to load", async () => {
    mountNames({ status: 500 });
    const onClick = vi.fn();
    const { queryClient } = renderCell(1, onClick);
    const button = screen.getByRole("button");

    fireEvent.mouseEnter(button);
    await waitFor(() =>
      expect(
        queryClient.getQueryState(
          orpc.macros.listCompatibleProtocols.queryKey({ input: { id: "macro-1" } }),
        )?.status,
      ).toBe("error"),
    );
    const retry = mountNames();
    fireEvent.click(button);

    expect(await screen.findByText("Compatible protocol")).toBeInTheDocument();
    expect(retry.callCount).toBe(1);
    expect(onClick).not.toHaveBeenCalled();
  });
});
