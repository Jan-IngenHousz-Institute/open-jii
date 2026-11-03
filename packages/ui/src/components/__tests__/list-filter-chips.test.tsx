import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ListFilterChips } from "../list-filter-chips";
import { labels, makeFilters } from "./list-filter-fixtures";

Element.prototype.scrollIntoView = vi.fn();

describe("ListFilterChips", () => {
  it("renders nothing while no filter is active", () => {
    const { container } = render(
      <ListFilterChips filters={makeFilters().filters} labels={labels} onClear={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows one chip per picked value in menu then option order", () => {
    const { filters } = makeFilters({ statuses: ["active", "draft"], visibilities: ["public"] });
    render(<ListFilterChips filters={filters} labels={labels} onClear={vi.fn()} />);

    const chips = screen.getAllByRole("group");
    expect(chips.map((chip) => chip.getAttribute("aria-label"))).toEqual([
      "Status is Draft",
      "Status is Active",
      "Visibility is Public",
    ]);
    expect(chips[0]).toHaveTextContent("Status" + "is" + "Draft");
  });

  it("removes only that value from its cross", async () => {
    const user = userEvent.setup();
    const { filters, onStatuses } = makeFilters({ statuses: ["draft", "active"] });
    render(<ListFilterChips filters={filters} labels={labels} onClear={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Remove Status is Draft" }));

    expect(onStatuses).toHaveBeenCalledWith(["active"]);
  });

  it("reopens the filter's checkbox list from the chip's value", async () => {
    const user = userEvent.setup();
    const { filters, onStatuses } = makeFilters({ statuses: ["draft"] });
    render(<ListFilterChips filters={filters} labels={labels} onClear={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Draft" }));
    const values = screen.getByRole("listbox", { name: "Status" });
    expect(within(values).getByRole("option", { name: "Draft" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await user.click(within(values).getByRole("option", { name: "Published" }));
    expect(onStatuses).toHaveBeenCalledWith(["draft", "published"]);
  });

  it("reopens the list of filters from the plus button", async () => {
    const user = userEvent.setup();
    const { filters } = makeFilters({ visibilities: ["private"] });
    render(<ListFilterChips filters={filters} labels={labels} onClear={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add filter" }));

    expect(screen.getByRole("listbox", { name: "Filter" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Status" })).toBeInTheDocument();
  });

  it("hides the plus button once every filter has a chip", () => {
    const { filters } = makeFilters({ statuses: ["draft"], visibilities: ["public"] });
    render(<ListFilterChips filters={filters} labels={labels} onClear={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Add filter" })).not.toBeInTheDocument();
  });

  it("ends the row with Clear filters", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const { filters } = makeFilters({ visibilities: ["public"] });
    render(<ListFilterChips filters={filters} labels={labels} onClear={onClear} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons[buttons.length - 1]).toHaveAccessibleName("Clear filters");

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
