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

interface DirectoryResult {
  organizations?: unknown[];
  isLoading?: boolean;
  error?: unknown;
  isPaused?: boolean;
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
function directoryReturns(byScope: { related?: DirectoryResult; all?: DirectoryResult }) {
  mockUseOrganizationDirectory.mockImplementation((args: DirectoryArgs) => {
    const result = (args.scope === "related" ? byScope.related : byScope.all) ?? {};
    return {
      organizations: result.organizations,
      isLoading: result.isLoading ?? false,
      error: result.error ?? null,
      isPaused: result.isPaused ?? false,
    };
  });
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
    directoryReturns({ related: { organizations: [entry("a", "member")] } });

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toEqual({ kind: "member" });
    // The wide query is still constructed, but disabled, so it issues no request.
    expect(argsFor("all")?.enabled).toBe(false);
  });

  it("has no state at all until the related query answers", () => {
    directoryReturns({ related: { isLoading: true } });

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(argsFor("all")?.enabled).toBe(false);
  });

  it("enables the wide query only once related came back empty", () => {
    directoryReturns({ related: { organizations: [] }, all: { isLoading: true } });

    renderHook(() => useOrganizationOnboardingState());

    expect(argsFor("all")?.enabled).toBe(true);
  });

  it("derives pending from the wide directory, which is the only place it shows", () => {
    const pending = entry("b", "pending_request");
    directoryReturns({
      related: { organizations: [] },
      all: { organizations: [entry("a", "none"), pending] },
    });

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toEqual({ kind: "pending", organization: pending });
  });

  it("derives none when the wide directory holds nothing for this user", () => {
    directoryReturns({
      related: { organizations: [] },
      all: { organizations: [entry("a", "none")] },
    });

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toEqual({ kind: "none" });
  });

  it("stays undecided while the wide query is still in flight", () => {
    directoryReturns({ related: { organizations: [] }, all: { isLoading: true } });

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toBeUndefined();
  });

  it("stops loading and surfaces the error when the related query fails", () => {
    const failure = new Error("offline");
    directoryReturns({ related: { error: failure } });

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(failure);
  });

  it("stops loading when the wide query fails after an empty related result", () => {
    const failure = new Error("offline");
    directoryReturns({ related: { organizations: [] }, all: { error: failure } });

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(failure);
  });

  it("reports paused from either query", () => {
    directoryReturns({ related: { organizations: [] }, all: { isPaused: true } });

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.isPaused).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("ignores the disabled wide query's flags while related says member", () => {
    directoryReturns({
      related: { organizations: [entry("a", "member")] },
      all: { isLoading: true },
    });

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toEqual({ kind: "member" });
    expect(result.current.isLoading).toBe(false);
  });
});
