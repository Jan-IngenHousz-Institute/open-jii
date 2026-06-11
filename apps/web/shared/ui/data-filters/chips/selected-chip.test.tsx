import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { SelectedChip } from "./selected-chip";

describe("SelectedChip", () => {
  it("renders the chip key as plain text by default", () => {
    render(
      <SelectedChip
        chipKey="alpha"
        contributorJson={undefined}
        isContributor={false}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("alpha")).toBeInTheDocument();
  });

  it("invokes onRemove with the chip key when the X button is clicked", async () => {
    const onRemove = vi.fn();
    render(
      <SelectedChip
        chipKey="alpha"
        contributorJson={undefined}
        isContributor={false}
        onRemove={onRemove}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "dataFilters.removeValue" }));
    expect(onRemove).toHaveBeenCalledWith("alpha");
  });

  it("renders the contributor identity when isContributor and a struct is provided", () => {
    const struct = JSON.stringify({ id: "u-1", name: "Alice", avatar: null });
    render(
      <SelectedChip chipKey="u-1" contributorJson={struct} isContributor onRemove={vi.fn()} />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("falls back to the chip key when isContributor is true but no struct is provided", () => {
    render(
      <SelectedChip chipKey="u-1" contributorJson={undefined} isContributor onRemove={vi.fn()} />,
    );
    expect(screen.getByText("u-1")).toBeInTheDocument();
  });
});
