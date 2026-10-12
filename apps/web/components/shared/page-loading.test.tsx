import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";
import { navigationTiming } from "~/lib/navigation-timing";

import { PageLoading } from "./page-loading";

describe("PageLoading", () => {
  it("says the page is loading", () => {
    render(<PageLoading />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("holds a navigation's settled time for as long as it is on screen", () => {
    const { unmount } = render(<PageLoading />);

    expect(navigationTiming.isLoadingScreenShown).toBe(true);

    unmount();

    expect(navigationTiming.isLoadingScreenShown).toBe(false);
  });

  it("uses the caller's message when given one", () => {
    render(<PageLoading message="Loading experiment" />);

    expect(screen.getByText("Loading experiment")).toBeInTheDocument();
  });
});
