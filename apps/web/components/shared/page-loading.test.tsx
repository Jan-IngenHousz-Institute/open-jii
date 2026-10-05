import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { PageLoading } from "./page-loading";

describe("PageLoading", () => {
  it("says the page is loading", () => {
    render(<PageLoading />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("uses the caller's message when given one", () => {
    render(<PageLoading message="Loading experiment" />);

    expect(screen.getByText("Loading experiment")).toBeInTheDocument();
  });
});
