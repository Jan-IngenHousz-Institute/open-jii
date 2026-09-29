import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { ResetSortingButton } from "./reset-sorting-button";

describe("ResetSortingButton", () => {
  it("renders nothing while no sort is active", () => {
    const { container } = render(<ResetSortingButton active={false} onReset={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("clears the sort when clicked", async () => {
    const onReset = vi.fn();
    render(<ResetSortingButton active onReset={onReset} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "common.resetSorting" }));

    expect(onReset).toHaveBeenCalledOnce();
  });
});
