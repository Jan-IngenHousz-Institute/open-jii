import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { ClearFiltersButton } from "./clear-filters-button";

describe("ClearFiltersButton", () => {
  it("renders nothing while no filter is active", () => {
    const { container } = render(<ClearFiltersButton active={false} onClear={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("clears the filters when clicked", async () => {
    const onClear = vi.fn();
    render(<ClearFiltersButton active onClear={onClear} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "common.clearFilters" }));

    expect(onClear).toHaveBeenCalledOnce();
  });
});
