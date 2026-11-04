import { render, screen, userEvent } from "@/test/test-utils";
import { CircleDashed } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import type { ListFilter } from "@repo/ui/components/list-filter-menu";

import { ListFilterBar } from "./list-filter-bar";

function statusFilter(selected: string[]): ListFilter {
  return {
    key: "status",
    label: "Status",
    icon: CircleDashed,
    options: [
      { value: "draft", label: "Draft" },
      { value: "active", label: "Active" },
    ],
    selected,
    onChange: vi.fn(),
  };
}

describe("ListFilterBar", () => {
  it("renders the search, the translated Filter menu and the extra actions in one row", () => {
    render(
      <ListFilterBar
        search={<input aria-label="Search" />}
        filters={[statusFilter([])]}
        onClearFilters={vi.fn()}
        actions={<button type="button">Sort</button>}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /common\.filter/u })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort" })).toBeInTheDocument();
  });

  it("shows a chip per picked value, and Clear filters calls back", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    render(
      <ListFilterBar
        search={null}
        filters={[statusFilter(["draft"])]}
        onClearFilters={onClearFilters}
      />,
    );

    expect(screen.getByRole("button", { name: /Draft/u })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "common.clearFilters" }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });
});
