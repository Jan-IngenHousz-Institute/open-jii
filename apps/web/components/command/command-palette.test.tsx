import {
  CHEATSHEET_OPEN_EVENT,
  COMMAND_PALETTE_OPEN_EVENT,
} from "@/components/shortcuts/shortcuts-root";
import { WHATS_NEW_OPEN_EVENT } from "@/components/whats-new/whats-new-shared";
import { render, screen, userEvent, act, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { CommandPalette } from "./command-palette";

function openPalette() {
  act(() => {
    window.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT));
  });
}

beforeEach(() => vi.clearAllMocks());

describe("CommandPalette", () => {
  it("opens on the command-palette event and lists pages and actions", async () => {
    render(<CommandPalette locale="en-US" />);
    openPalette();
    expect(await screen.findByPlaceholderText("Search pages and actions…")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Create experiment")).toBeInTheDocument();
    expect(screen.getByText("Open What's new")).toBeInTheDocument();
    expect(screen.getByText("Open documentation")).toBeInTheDocument();
  });

  it("navigates to each page / create action it lists", async () => {
    const user = userEvent.setup();
    const { router } = render(<CommandPalette locale="en-US" />);
    const cases: [string, string][] = [
      ["Home", "/en-US/platform"],
      ["Experiments", "/en-US/platform/experiments"],
      ["Workbooks", "/en-US/platform/workbooks"],
      ["Commands", "/en-US/platform/commands"],
      ["Macros", "/en-US/platform/macros"],
      ["Transfer requests", "/en-US/platform/transfer-request"],
      ["Settings", "/en-US/platform/account"],
      ["Create experiment", "/en-US/platform/experiments/new"],
    ];
    for (const [label, path] of cases) {
      openPalette();
      await user.click(await screen.findByText(label));
      expect(router.push).toHaveBeenCalledWith(path);
    }
  });

  it("dispatches the cheatsheet event from the palette action", async () => {
    const handler = vi.fn();
    window.addEventListener(CHEATSHEET_OPEN_EVENT, handler);
    const user = userEvent.setup();
    render(<CommandPalette locale="en-US" />);
    openPalette();
    await user.click(await screen.findByText("Show keyboard shortcuts"));
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(CHEATSHEET_OPEN_EVENT, handler);
  });

  it("dispatches the whats-new event from the palette action", async () => {
    const handler = vi.fn();
    window.addEventListener(WHATS_NEW_OPEN_EVENT, handler);
    const user = userEvent.setup();
    render(<CommandPalette locale="en-US" />);
    openPalette();
    await user.click(await screen.findByText("Open What's new"));
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(WHATS_NEW_OPEN_EVENT, handler);
  });

  it("opens external docs without navigating", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const user = userEvent.setup();
    render(<CommandPalette locale="en-US" />);
    openPalette();
    await user.click(await screen.findByText("Open documentation"));
    expect(openSpy).toHaveBeenCalledWith(
      "https://docs.openjii.org",
      "_blank",
      "noopener,noreferrer",
    );
    openSpy.mockRestore();
  });

  it("filters items by query", async () => {
    const user = userEvent.setup();
    render(<CommandPalette locale="en-US" />);
    openPalette();
    const input = await screen.findByPlaceholderText("Search pages and actions…");
    await user.type(input, "macro");
    await waitFor(() => expect(screen.getByText("Macros")).toBeInTheDocument());
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });
});
