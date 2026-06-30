/**
 * Anti-flicker behaviour for the linked-workbook upgrade banner.
 *
 * Lives in its own file because it stubs React Query's `useIsFetching` /
 * `useIsMutating` to place the card mid-save / mid-refetch deterministically.
 * The MSW-backed suite in `linked-workbook-card.test.tsx` can't do this, since
 * React Query swaps query data atomically when a fetch settles (there is no
 * real frame where the new value is present while still fetching).
 *
 * The stubs also assert the card subscribes with the exact keys the workbook
 * queries/mutations use, so wrong wiring fails the freeze tests.
 */
import { createWorkbook, createWorkbookVersionSummary } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LinkedWorkbookCard } from "./linked-workbook-card";

const { syncState } = vi.hoisted(() => ({
  syncState: { workbook: 0, versions: 0, mutating: 0, upgrading: 0 },
}));

vi.mock("@tanstack/react-query", async (importActual) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importActual<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useIsFetching: (filters?: { queryKey?: unknown[] }) => {
      // oRPC query keys look like [["workbooks", "<endpoint>"], { input }].
      const path = filters?.queryKey?.[0];
      const endpoint: unknown = Array.isArray(path) ? path[1] : undefined;
      if (endpoint === "getWorkbook") return syncState.workbook;
      if (endpoint === "listWorkbookVersions") return syncState.versions;
      return 0;
    },
    useIsMutating: (filters?: { mutationKey?: unknown[] }) => {
      const key = filters?.mutationKey;
      if (key?.[0] === "workbook" && key[2] === "update") return syncState.mutating;
      if (key?.[0] === "experiment" && key[2] === "upgradeWorkbook") return syncState.upgrading;
      return 0;
    },
  };
});

const mockUseWorkbook = vi.fn();
vi.mock("@/hooks/workbook/useWorkbook/useWorkbook", () => ({
  useWorkbook: (...args: unknown[]): unknown => mockUseWorkbook(...args),
}));

const mockUseWorkbookVersions = vi.fn();
vi.mock("@/hooks/workbook/useWorkbookVersions/useWorkbookVersions", () => ({
  useWorkbookVersions: (...args: unknown[]): unknown => mockUseWorkbookVersions(...args),
}));

vi.mock("@/hooks/workbook/useWorkbookList/useWorkbookList", () => ({
  useWorkbookList: () => ({ data: [] }),
}));
vi.mock("@/hooks/experiment/useAttachWorkbook/useAttachWorkbook", () => ({
  useAttachWorkbook: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/experiment/useDetachWorkbook/useDetachWorkbook", () => ({
  useDetachWorkbook: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/experiment/useUpgradeWorkbookVersion/useUpgradeWorkbookVersion", () => ({
  useUpgradeWorkbookVersion: () => ({ mutate: vi.fn() }),
}));

const WORKBOOK_ID = "11111111-1111-1111-1111-111111111111";
// Pinned == latest published, so the banner is driven solely by the
// server-computed `isUpgradable` flag, not by a newer published version.
const pinnedVersion = createWorkbookVersionSummary({ workbookId: WORKBOOK_ID, version: 1 });

const props = {
  experimentId: "exp-1",
  locale: "en-US",
  workbookId: WORKBOOK_ID,
  workbookVersionId: pinnedVersion.id,
  hasAccess: true,
};

function setUpgradable(isUpgradable: boolean) {
  mockUseWorkbook.mockReturnValue({
    data: createWorkbook({ id: WORKBOOK_ID, name: "My Workbook", isUpgradable }),
    isLoading: false,
    error: null,
  });
}

const card = () => <LinkedWorkbookCard {...props} />;
const upgradeButton = () => screen.queryByRole("button", { name: /flow\.upgradeToLatest/i });

describe("LinkedWorkbookCard upgrade banner (anti-flicker)", () => {
  beforeEach(() => {
    syncState.workbook = 0;
    syncState.versions = 0;
    syncState.mutating = 0;
    syncState.upgrading = 0;
    mockUseWorkbookVersions.mockReturnValue({ data: [pinnedVersion] });
  });

  it("shows the banner when the workbook is upgradable and all state is settled", () => {
    setUpgradable(true);
    render(card());
    expect(upgradeButton()).toBeInTheDocument();
  });

  it("does not flash the banner when isUpgradable briefly reads true during a save", () => {
    // Settled, not upgradable: no banner.
    setUpgradable(false);
    const { rerender } = render(card());
    expect(upgradeButton()).not.toBeInTheDocument();

    // Autosave in flight and its refetch transiently reports isUpgradable=true
    // before the server settles it back to false. This is the reported flicker.
    syncState.mutating = 1;
    syncState.workbook = 1;
    setUpgradable(true);
    rerender(card());
    expect(upgradeButton()).not.toBeInTheDocument();

    // Everything settles back to not-upgradable: the banner never appeared.
    syncState.mutating = 0;
    syncState.workbook = 0;
    setUpgradable(false);
    rerender(card());
    expect(upgradeButton()).not.toBeInTheDocument();
  });

  it("does not flash the banner while an auto-apply upgrade is in flight", () => {
    // Settled, not upgradable (just re-pinned): no banner.
    setUpgradable(false);
    const { rerender } = render(card());
    expect(upgradeButton()).not.toBeInTheDocument();

    // The save refetch has settled showing isUpgradable=true, but the auto-apply
    // upgrade that re-pins the version is still running. Stay frozen (hidden).
    syncState.upgrading = 1;
    setUpgradable(true);
    rerender(card());
    expect(upgradeButton()).not.toBeInTheDocument();

    // Upgrade settles and re-pins; isUpgradable is false again. Never flashed.
    syncState.upgrading = 0;
    setUpgradable(false);
    rerender(card());
    expect(upgradeButton()).not.toBeInTheDocument();
  });

  it("holds an upgrade that becomes available until sync settles, then commits it", () => {
    setUpgradable(false);
    const { rerender } = render(card());
    expect(upgradeButton()).not.toBeInTheDocument();

    // New (genuinely upgradable) value arrives while a versions refetch is in
    // flight, held back so it can't blink in mid-sync.
    syncState.versions = 1;
    setUpgradable(true);
    rerender(card());
    expect(upgradeButton()).not.toBeInTheDocument();

    // Once settled the banner appears and stays: a single, clean transition.
    syncState.versions = 0;
    rerender(card());
    expect(upgradeButton()).toBeInTheDocument();
  });
});
