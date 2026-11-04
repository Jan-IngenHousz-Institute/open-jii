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

  it("keeps the plus button once every filter has a chip", async () => {
    const user = userEvent.setup();
    const { filters } = makeFilters({ statuses: ["draft"], visibilities: ["public"] });
    render(<ListFilterChips filters={filters} labels={labels} onClear={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add filter" }));

    expect(screen.getByRole("listbox", { name: "Filter" })).toBeInTheDocument();
  });

  it("keeps the list open when the value its chip showed is unticked", async () => {
    const user = userEvent.setup();
    const { filters, onStatuses } = makeFilters({ statuses: ["draft", "active"] });
    const { rerender } = render(
      <ListFilterChips filters={filters} labels={labels} onClear={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Draft" }));
    await user.click(screen.getByRole("option", { name: "Draft" }));
    expect(onStatuses).toHaveBeenCalledWith(["active"]);
    rerender(
      <ListFilterChips
        filters={makeFilters({ statuses: ["active"] }).filters}
        labels={labels}
        onClear={vi.fn()}
      />,
    );

    const values = screen.getByRole("listbox", { name: "Status" });
    expect(within(values).getByRole("option", { name: "Draft" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.queryByRole("group", { name: "Status is Draft" })).not.toBeInTheDocument();
  });

  it("keeps the row and the list open when the only value is unticked", async () => {
    const user = userEvent.setup();
    const { filters } = makeFilters({ statuses: ["draft"] });
    const { rerender } = render(
      <ListFilterChips filters={filters} labels={labels} onClear={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Draft" }));
    rerender(<ListFilterChips filters={makeFilters().filters} labels={labels} onClear={vi.fn()} />);

    const values = screen.getByRole("listbox", { name: "Status" });
    await user.click(within(values).getByRole("option", { name: "Active" }));
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("closes the list from the same chip value", async () => {
    const user = userEvent.setup();
    const { filters } = makeFilters({ statuses: ["draft"] });
    render(<ListFilterChips filters={filters} labels={labels} onClear={vi.fn()} />);

    const value = screen.getByRole("button", { name: "Draft" });
    await user.click(value);
    expect(value).toHaveAttribute("aria-expanded", "true");
    await user.click(value);

    expect(screen.queryByRole("listbox", { name: "Status" })).not.toBeInTheDocument();
    expect(value).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the plus menu open when it gives the last unused filter a value", async () => {
    const user = userEvent.setup();
    const { filters, onStatuses } = makeFilters({ visibilities: ["public"] });
    const { rerender } = render(
      <ListFilterChips filters={filters} labels={labels} onClear={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Add filter" }));
    await user.click(screen.getByRole("option", { name: "Status" }));
    await user.click(screen.getByRole("option", { name: "Draft" }));
    expect(onStatuses).toHaveBeenCalledWith(["draft"]);
    rerender(
      <ListFilterChips
        filters={makeFilters({ statuses: ["draft"], visibilities: ["public"] }).filters}
        labels={labels}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByRole("listbox", { name: "Filter" })).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Status" })).toBeInTheDocument();
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
