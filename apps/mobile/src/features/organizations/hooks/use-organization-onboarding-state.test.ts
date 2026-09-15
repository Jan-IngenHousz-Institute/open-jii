import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOrganizationOnboardingState } from "./use-organization-onboarding-state";

const { mockUseOrganizationDirectory } = vi.hoisted(() => ({
  mockUseOrganizationDirectory: vi.fn(),
}));

vi.mock("~/features/organizations/hooks/use-organization-directory", () => ({
  useOrganizationDirectory: (...args: unknown[]) => mockUseOrganizationDirectory(...args),
}));

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

function directoryReturns(organizations: unknown[] | undefined, isLoading = false) {
  mockUseOrganizationDirectory.mockReturnValue({ organizations, isLoading });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useOrganizationOnboardingState", () => {
  it("reuses the unfiltered directory query, so Home and the directory share one entry", () => {
    directoryReturns([]);

    renderHook(() => useOrganizationOnboardingState());

    expect(mockUseOrganizationDirectory).toHaveBeenCalledWith();
  });

  it("is none when the user belongs to nothing and has asked for nothing", () => {
    directoryReturns([entry("a", "none")]);

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toEqual({ kind: "none" });
  });

  it("carries the organization when a request is pending", () => {
    const pending = entry("b", "pending_request");
    directoryReturns([entry("a", "none"), pending]);

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toEqual({ kind: "pending", organization: pending });
  });

  it("is member as soon as one membership exists", () => {
    directoryReturns([entry("a", "pending_request"), entry("b", "member")]);

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toEqual({ kind: "member" });
  });

  it("has no state at all until the directory answers", () => {
    directoryReturns(undefined);

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toBeUndefined();
  });

  it("reports none only for a directory that really came back empty", () => {
    directoryReturns([]);

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.state).toEqual({ kind: "none" });
  });

  it("passes the directory's loading flag through", () => {
    directoryReturns([], true);

    const { result } = renderHook(() => useOrganizationOnboardingState());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.state).toEqual({ kind: "none" });
  });
});
