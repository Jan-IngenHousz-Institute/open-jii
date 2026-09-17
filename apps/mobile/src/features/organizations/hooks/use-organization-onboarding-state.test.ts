// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOrganizationOnboardingState } from "./use-organization-onboarding-state";

const { mockUseOrganizationDirectory } = vi.hoisted(() => ({
  mockUseOrganizationDirectory: vi.fn(),
}));

vi.mock("~/features/organizations/hooks/use-organization-directory", () => ({
  useOrganizationDirectory: (args: unknown) => mockUseOrganizationDirectory(args),
}));

interface DirectoryArgs {
  scope?: "related" | "all";
  enabled?: boolean;
}

function entry(id: string, membershipStatus: "none" | "pending_request" | "member") {
  return {
    id,
    name: `Org ${id}`,
    slug: null,
    logo: null,
    type: null,
    description: null,
    location: null,
    memberCount: 1,
    resourceCount: 0,
    visibility: "public" as const,
    membershipStatus,
  };
}

/** Answers each of the hook's two queries by the scope it asked for. */
function directoryReturns(byScope: {
  related?: unknown[];
  all?: unknown[];
  relatedLoading?: boolean;
}) {
  mockUseOrganizationDirectory.mockImplementation((args: DirectoryArgs) =>
    args.scope === "related"
      ? { organizations: byScope.related, isLoading: byScope.relatedLoading ?? false }
      : { organizations: byScope.all, isLoading: false },
  );
}

function argsFor(scope: "related" | "all"): DirectoryArgs | undefined {
  return mockUseOrganizationDirectory.mock.calls
    .map(([args]) => args as DirectoryArgs)
    .find((args) => args.scope === scope);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useOrganizationOnboardingState", () => {
  it("answers member from the related query without fetching the whole directory", () => {
    directoryReturns({ related: [entry("a", "member")] });

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toEqual({ kind: "member" });
    // The wide query is still constructed, but disabled, so it issues no request.
    expect(argsFor("all")?.enabled).toBe(false);
  });

  it("has no state at all until the related query answers", () => {
    directoryReturns({ related: undefined, relatedLoading: true });

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(argsFor("all")?.enabled).toBe(false);
  });

  it("enables the wide query only once related came back empty", () => {
    directoryReturns({ related: [], all: undefined });

    renderHook(() => useOrganizationOnboardingState());

    expect(argsFor("all")?.enabled).toBe(true);
  });

  it("derives pending from the wide directory, which is the only place it shows", () => {
    const pending = entry("b", "pending_request");
    directoryReturns({ related: [], all: [entry("a", "none"), pending] });

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toEqual({ kind: "pending", organization: pending });
  });

  it("derives none when the wide directory holds nothing for this user", () => {
    directoryReturns({ related: [], all: [entry("a", "none")] });

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toEqual({ kind: "none" });
  });

  it("stays undecided while the wide query is still in flight", () => {
    directoryReturns({ related: [], all: undefined });

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toBeUndefined();
  });
});
