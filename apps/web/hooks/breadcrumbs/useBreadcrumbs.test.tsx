import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { enrichPathSegments } from "~/app/actions/breadcrumbs";

import { useBreadcrumbs } from "./useBreadcrumbs";

// Mock next/navigation
const mockPathname = "/en/platform/experiments/new";
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

// Mock enrichPathSegments action
vi.mock("~/app/actions/breadcrumbs", () => ({
  enrichPathSegments: vi.fn(),
}));

const mockEnrichPathSegments = vi.mocked(enrichPathSegments);
const mockUsePathname = vi.fn();

describe("useBreadcrumbs", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue(mockPathname);
  });

  it("should call enrichPathSegments with pathname and locale", () => {
    mockEnrichPathSegments.mockResolvedValue([
      { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
      { segment: "new", title: "new", href: "/en/platform/experiments/new" },
    ]);

    renderHook(() => useBreadcrumbs("en"), {
      wrapper: createWrapper(),
    });

    expect(mockEnrichPathSegments).toHaveBeenCalledWith(mockPathname, "en");
  });

  it("should return breadcrumb data", () => {
    const mockData = [
      { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
      { segment: "new", title: "new", href: "/en/platform/experiments/new" },
    ];

    mockEnrichPathSegments.mockResolvedValue(mockData);

    renderHook(() => useBreadcrumbs("en"), {
      wrapper: createWrapper(),
    });

    expect(mockEnrichPathSegments).toHaveBeenCalledWith(mockPathname, "en");
  });

  it("should handle loading state", () => {
    mockEnrichPathSegments.mockResolvedValue([]);

    const { result } = renderHook(() => useBreadcrumbs("en"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("should handle errors", () => {
    const mockError = new Error("Failed to fetch breadcrumbs");
    mockEnrichPathSegments.mockRejectedValue(mockError);

    renderHook(() => useBreadcrumbs("en"), {
      wrapper: createWrapper(),
    });

    expect(mockEnrichPathSegments).toHaveBeenCalledWith(mockPathname, "en");
  });

  it("should use correct query key with pathname and locale", () => {
    mockEnrichPathSegments.mockResolvedValue([]);
    mockUsePathname.mockReturnValue("/de/platform/protocols");

    renderHook(() => useBreadcrumbs("de"), {
      wrapper: createWrapper(),
    });

    expect(mockEnrichPathSegments).toHaveBeenCalledWith("/de/platform/protocols", "de");
  });

  it("should return empty array for platform root", () => {
    mockUsePathname.mockReturnValue("/en/platform");
    mockEnrichPathSegments.mockResolvedValue([]);

    renderHook(() => useBreadcrumbs("en"), {
      wrapper: createWrapper(),
    });

    expect(mockEnrichPathSegments).toHaveBeenCalledWith("/en/platform", "en");
  });

  it("should update when pathname changes", () => {
    mockEnrichPathSegments.mockResolvedValue([
      { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
    ]);

    renderHook(() => useBreadcrumbs("en"), {
      wrapper: createWrapper(),
      initialProps: { pathname: "/en/platform/experiments" },
    });

    expect(mockEnrichPathSegments).toHaveBeenCalledWith(mockPathname, "en");

    // Change pathname
    mockUsePathname.mockReturnValue("/en/platform/protocols");
    mockEnrichPathSegments.mockResolvedValue([
      { segment: "protocols", title: "protocols", href: "/en/platform/protocols" },
    ]);
  });

  it("should handle different locales", () => {
    mockEnrichPathSegments.mockResolvedValue([
      { segment: "experiments", title: "experiments", href: "/de/platform/experiments" },
    ]);

    renderHook(() => useBreadcrumbs("de"), {
      wrapper: createWrapper(),
    });

    expect(mockEnrichPathSegments).toHaveBeenCalledWith(mockPathname, "de");
  });

  it("should handle entity paths with UUIDs", () => {
    mockUsePathname.mockReturnValue(
      "/en/platform/experiments/a1b2c3d4-e5f6-4890-abcd-ef1234567890",
    );
    mockEnrichPathSegments.mockResolvedValue([
      { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
      {
        segment: "a1b2c3d4-e5f6-4890-abcd-ef1234567890",
        title: "My Experiment",
        href: "/en/platform/experiments/a1b2c3d4-e5f6-4890-abcd-ef1234567890",
      },
    ]);

    renderHook(() => useBreadcrumbs("en"), {
      wrapper: createWrapper(),
    });

    expect(mockEnrichPathSegments).toHaveBeenCalledWith(
      "/en/platform/experiments/a1b2c3d4-e5f6-4890-abcd-ef1234567890",
      "en",
    );
  });
});
