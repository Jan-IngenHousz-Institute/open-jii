import { renderHook } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichPathSegments } from "~/app/actions/breadcrumbs";

import { useBreadcrumbs } from "./useBreadcrumbs";

vi.mock("~/app/actions/breadcrumbs", () => ({
  enrichPathSegments: vi.fn(),
}));

const mockEnrich = vi.mocked(enrichPathSegments);

describe("useBreadcrumbs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/en/platform/experiments/new");
  });

  it("calls enrichPathSegments with pathname and locale", () => {
    mockEnrich.mockResolvedValue([]);
    renderHook(() => useBreadcrumbs("en"));
    expect(mockEnrich).toHaveBeenCalledWith("/en/platform/experiments/new", "en");
  });

  it("returns loading state initially", () => {
    mockEnrich.mockResolvedValue([]);
    const { result } = renderHook(() => useBreadcrumbs("en"));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("handles different locales", () => {
    mockEnrich.mockResolvedValue([]);
    renderHook(() => useBreadcrumbs("de"));
    expect(mockEnrich).toHaveBeenCalledWith("/en/platform/experiments/new", "de");
  });

  it("uses correct pathname", () => {
    vi.mocked(usePathname).mockReturnValue("/en/platform");
    mockEnrich.mockResolvedValue([]);
    renderHook(() => useBreadcrumbs("en"));
    expect(mockEnrich).toHaveBeenCalledWith("/en/platform", "en");
  });

  it("handles entity paths with UUIDs", () => {
    const uuid = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";
    vi.mocked(usePathname).mockReturnValue(`/en/platform/experiments/${uuid}`);
    mockEnrich.mockResolvedValue([]);
    renderHook(() => useBreadcrumbs("en"));
    expect(mockEnrich).toHaveBeenCalledWith(`/en/platform/experiments/${uuid}`, "en");
  });
});
