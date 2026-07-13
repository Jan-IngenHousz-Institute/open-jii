import {
  CHEATSHEET_OPEN_EVENT,
  COMMAND_PALETTE_OPEN_EVENT,
} from "@/components/shortcuts/shortcuts-root";
import { WHATS_NEW_OPEN_EVENT } from "@/components/whats-new/whats-new-shared";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { render, screen, userEvent, act, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { SearchResult } from "@repo/api/schemas/search.schema";

import { CommandPalette } from "./command-palette";

vi.mock("@/hooks/useGlobalSearch", () => ({
  useGlobalSearch: vi.fn(),
}));

const mockUseGlobalSearch = vi.mocked(useGlobalSearch);

type GlobalSearchReturn = ReturnType<typeof useGlobalSearch>;

function mockSearch(overrides: {
  results?: SearchResult[];
  isSearching?: boolean;
  isError?: boolean;
  enabled?: boolean;
}) {
  mockUseGlobalSearch.mockReturnValue({
    results: overrides.results ?? [],
    isSearching: overrides.isSearching ?? false,
    isError: overrides.isError ?? false,
    enabled: overrides.enabled ?? true,
  } as unknown as GlobalSearchReturn);
}

function openPalette() {
  act(() => {
    window.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: search is gated on a >=2 char query and returns nothing.
  mockUseGlobalSearch.mockImplementation(
    (query: string) =>
      ({
        results: [],
        isSearching: false,
        isError: false,
        enabled: query.trim().length >= 2,
      }) as unknown as GlobalSearchReturn,
  );
});

describe("CommandPalette", () => {
  it("opens on the command-palette event and lists pages and actions", async () => {
    render(<CommandPalette locale="en-US" />);
    openPalette();
    expect(await screen.findByPlaceholderText("commandPalette.placeholder")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.entries.home")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.entries.createExperiment")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.entries.openWhatsNew")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.entries.openDocumentation")).toBeInTheDocument();
  });

  it("navigates to each page / create action it lists", async () => {
    const user = userEvent.setup();
    const { router } = render(<CommandPalette locale="en-US" />);
    const cases: [string, string][] = [
      ["commandPalette.entries.home", "/en-US/platform"],
      ["commandPalette.entries.experiments", "/en-US/platform/experiments"],
      ["commandPalette.entries.workbooks", "/en-US/platform/workbooks"],
      ["commandPalette.entries.protocols", "/en-US/platform/protocols"],
      ["commandPalette.entries.macros", "/en-US/platform/macros"],
      ["commandPalette.entries.transferRequests", "/en-US/platform/transfer-request"],
      ["commandPalette.entries.settings", "/en-US/platform/account"],
      ["commandPalette.entries.createExperiment", "/en-US/platform/experiments/new"],
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
    await user.click(await screen.findByText("commandPalette.entries.showKeyboardShortcuts"));
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(CHEATSHEET_OPEN_EVENT, handler);
  });

  it("dispatches the whats-new event from the palette action", async () => {
    const handler = vi.fn();
    window.addEventListener(WHATS_NEW_OPEN_EVENT, handler);
    const user = userEvent.setup();
    render(<CommandPalette locale="en-US" />);
    openPalette();
    await user.click(await screen.findByText("commandPalette.entries.openWhatsNew"));
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(WHATS_NEW_OPEN_EVENT, handler);
  });

  it("opens external docs without navigating", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const user = userEvent.setup();
    render(<CommandPalette locale="en-US" />);
    openPalette();
    await user.click(await screen.findByText("commandPalette.entries.openDocumentation"));
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
    const input = await screen.findByPlaceholderText("commandPalette.placeholder");
    await user.type(input, "macro");
    await waitFor(() =>
      expect(screen.getByText("commandPalette.entries.macros")).toBeInTheDocument(),
    );
    expect(screen.queryByText("commandPalette.entries.home")).not.toBeInTheDocument();
  });

  it("renders grouped server results and navigates to a selected one", async () => {
    mockSearch({
      enabled: true,
      results: [
        {
          type: "experiment",
          id: "11111111-1111-1111-1111-111111111111",
          title: "Photosynthesis trial",
          subtitle: "A leaf study",
          meta: null,
        },
        {
          type: "protocol",
          id: "22222222-2222-2222-2222-222222222222",
          title: "Photosynthesis protocol",
          subtitle: null,
          meta: "multispeq",
        },
      ],
    });
    const user = userEvent.setup();
    const { router } = render(<CommandPalette locale="en-US" />);
    openPalette();
    const input = await screen.findByPlaceholderText("commandPalette.placeholder");
    await user.type(input, "photo");

    expect(await screen.findByText("Photosynthesis trial")).toBeInTheDocument();
    expect(screen.getByText("Photosynthesis protocol")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.results.experiments")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.results.protocols")).toBeInTheDocument();

    await user.click(screen.getByText("Photosynthesis trial"));
    expect(router.push).toHaveBeenCalledWith(
      "/en-US/platform/experiments/11111111-1111-1111-1111-111111111111",
    );
  });

  it("shows a loading state while searching", async () => {
    mockSearch({ enabled: true, isSearching: true });
    const user = userEvent.setup();
    render(<CommandPalette locale="en-US" />);
    openPalette();
    const input = await screen.findByPlaceholderText("commandPalette.placeholder");
    await user.type(input, "photo");
    expect(await screen.findByText("commandPalette.status.searching")).toBeInTheDocument();
  });

  it("shows a no-matches message when the server returns nothing", async () => {
    mockSearch({ enabled: true, results: [] });
    const user = userEvent.setup();
    render(<CommandPalette locale="en-US" />);
    openPalette();
    const input = await screen.findByPlaceholderText("commandPalette.placeholder");
    await user.type(input, "zzz");
    expect(await screen.findByText("commandPalette.status.noResultsTitle")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.status.noResultsDescription")).toBeInTheDocument();
  });
});
