import {
  CHEATSHEET_OPEN_EVENT,
  COMMAND_PALETTE_OPEN_EVENT,
} from "@/components/shortcuts/shortcuts-root";
import { WHATS_NEW_OPEN_EVENT } from "@/components/whats-new/whats-new-shared";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { createSearchResult } from "@/test/factories";
import { render, screen, userEvent, act, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { env } from "~/env";

import type { SearchResult } from "@repo/api/domains/search/search.schema";

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
      ["commandPalette.entries.organizations", "/en-US/platform/organizations"],
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
    expect(openSpy).toHaveBeenCalledWith(env.NEXT_PUBLIC_DOCS_URL, "_blank", "noopener,noreferrer");
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

  it("renders server results in backend rank order and navigates to a selected one", async () => {
    mockSearch({
      enabled: true,
      results: [
        createSearchResult({
          type: "organization",
          id: "44444444-4444-4444-4444-444444444444",
          title: "Photosynthesis Lab",
          meta: "research_institute",
        }),
        createSearchResult({
          type: "experiment",
          id: "11111111-1111-1111-1111-111111111111",
          title: "Photosynthesis trial",
          subtitle: "A leaf study",
        }),
        createSearchResult({
          type: "protocol",
          id: "22222222-2222-2222-2222-222222222222",
          title: "Photosynthesis protocol",
          meta: "multispeq",
        }),
        createSearchResult({
          type: "workbook",
          id: "33333333-3333-3333-3333-333333333333",
          title: "Photosynthesis workbook",
        }),
      ],
    });
    const user = userEvent.setup();
    const { router } = render(<CommandPalette locale="en-US" />);
    openPalette();
    const input = await screen.findByPlaceholderText("commandPalette.placeholder");
    await user.type(input, "photo");

    const organization = await screen.findByText("Photosynthesis Lab");
    const experiment = screen.getByText("Photosynthesis trial");
    expect(
      organization.compareDocumentPosition(experiment) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(experiment).toBeInTheDocument();
    expect(screen.getByText("Photosynthesis protocol")).toBeInTheDocument();
    expect(screen.getByText("MultispeQ")).toBeInTheDocument();
    expect(screen.getByText("Photosynthesis workbook")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.groups.searchResults")).toBeInTheDocument();

    await user.click(screen.getByText("Photosynthesis workbook"));
    expect(router.push).toHaveBeenCalledWith(
      "/en-US/platform/workbooks/33333333-3333-3333-3333-333333333333",
    );
  });

  it.each([
    ["dashboard", "dashboards"],
    ["visualization", "analysis/visualizations"],
  ] as const)("shows the experiment and opens a %s inside it", async (type, segment) => {
    const parent = {
      type: "experiment" as const,
      id: crypto.randomUUID(),
      title: `Canopy ${crypto.randomUUID()}`,
    };
    const id = crypto.randomUUID();
    const title = `Search child ${crypto.randomUUID()}`;
    mockSearch({
      results: [createSearchResult({ type, id, title, subtitle: "A leaf study", parent })],
    });
    const user = userEvent.setup();
    const { router } = render(<CommandPalette locale="en-US" />);
    openPalette();
    await user.type(await screen.findByPlaceholderText("commandPalette.placeholder"), "canopy");
    expect(await screen.findByText(`in ${parent.title}`)).toBeInTheDocument();
    expect(screen.getByText("A leaf study")).toBeInTheDocument();
    await user.click(screen.getByText(title));
    expect(router.push).toHaveBeenCalledWith(
      `/en-US/platform/experiments/${parent.id}/${segment}/${id}`,
    );
  });

  it.each(["dashboard", "visualization"] as const)(
    "does not navigate a %s with no experiment",
    async (type) => {
      const title = `Orphan ${crypto.randomUUID()}`;
      mockSearch({
        results: [createSearchResult({ type, id: crypto.randomUUID(), title, parent: null })],
      });
      const user = userEvent.setup();
      const { router } = render(<CommandPalette locale="en-US" />);
      openPalette();
      await user.type(await screen.findByPlaceholderText("commandPalette.placeholder"), "orphan");
      await user.click(await screen.findByText(title));
      expect(router.push).not.toHaveBeenCalled();
    },
  );

  it("navigates to a selected organization result", async () => {
    mockSearch({
      enabled: true,
      results: [
        createSearchResult({
          type: "organization",
          id: "44444444-4444-4444-4444-444444444444",
          title: "Photosynthesis Lab",
          subtitle: "A shared greenhouse",
          meta: "research_institute",
        }),
      ],
    });
    const user = userEvent.setup();
    const { router } = render(<CommandPalette locale="en-US" />);
    openPalette();
    const input = await screen.findByPlaceholderText("commandPalette.placeholder");
    await user.type(input, "photo");

    // The type renders through the shared organization label map, not raw enum text.
    expect(await screen.findByText("organizations.types.research_institute")).toBeInTheDocument();

    await user.click(screen.getByText("Photosynthesis Lab"));
    expect(router.push).toHaveBeenCalledWith(
      "/en-US/platform/organizations/44444444-4444-4444-4444-444444444444",
    );
  });

  it("shows a device's family and serial number and navigates to its detail page", async () => {
    mockSearch({
      results: [
        createSearchResult({
          type: "device",
          id: "55555555-5555-5555-5555-555555555555",
          title: "Canopy sensor",
          subtitle: "MSQ-20431",
          meta: "multispeq",
        }),
      ],
    });
    const user = userEvent.setup();
    const { router } = render(<CommandPalette locale="de-DE" />);
    openPalette();
    const input = await screen.findByPlaceholderText("commandPalette.placeholder");
    await user.type(input, "canopy");

    expect(await screen.findByText("MultispeQ")).toBeInTheDocument();
    expect(screen.getByText("MSQ-20431")).toBeInTheDocument();
    await user.click(screen.getByText("Canopy sensor"));
    expect(router.push).toHaveBeenCalledWith(
      "/de-DE/platform/devices/55555555-5555-5555-5555-555555555555",
    );
  });

  it("shows an unrecognised protocol family as stored", async () => {
    mockSearch({
      enabled: true,
      results: [
        createSearchResult({
          type: "protocol",
          id: "22222222-2222-2222-2222-222222222222",
          title: "Photosynthesis protocol",
          meta: "prototype-x",
        }),
      ],
    });
    const user = userEvent.setup();
    render(<CommandPalette locale="en-US" />);
    openPalette();
    const input = await screen.findByPlaceholderText("commandPalette.placeholder");
    await user.type(input, "photo");

    expect(await screen.findByText("prototype-x")).toBeInTheDocument();
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
