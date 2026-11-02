import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CircleDashed, Eye } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import type { ListFilter, ListFilterLabels } from "../list-filter-menu";
import { ListFilterChips, ListFilterMenu } from "../list-filter-menu";

Element.prototype.scrollIntoView = vi.fn();

const labels: ListFilterLabels = {
  filter: "Filter",
  addFilter: "Add filter",
  is: "is",
  clearFilters: "Clear filters",
  selectedCount: (count) => `${count} selected`,
  removeValue: (filter, value) => `Remove ${filter} is ${value}`,
};

type Status = "draft" | "active" | "published";
type Visibility = "private" | "public";

function makeFilters({
  statuses = [],
  visibilities = [],
}: { statuses?: Status[]; visibilities?: Visibility[] } = {}) {
  const onStatuses = vi.fn<(values: Status[]) => void>();
  const onVisibilities = vi.fn<(values: Visibility[]) => void>();
  const filters: ListFilter[] = [
    {
      key: "status",
      label: "Status",
      icon: CircleDashed,
      options: [
        { value: "draft", label: "Draft" },
        { value: "active", label: "Active" },
        { value: "published", label: "Published" },
      ],
      selected: statuses,
      onChange: onStatuses,
    },
    {
      key: "visibility",
      label: "Visibility",
      icon: Eye,
      options: [
        { value: "private", label: "Private" },
        { value: "public", label: "Public" },
      ],
      selected: visibilities,
      onChange: onVisibilities,
    },
  ];
  return { filters, onStatuses, onVisibilities };
}

describe("ListFilterMenu", () => {
  it("shows one Filter button without a count while nothing is picked", () => {
    render(<ListFilterMenu filters={makeFilters().filters} labels={labels} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAccessibleName("Filter");
    expect(button).toHaveTextContent(/^Filter$/);
  });

  it("counts every picked value across filters on the button", () => {
    const { filters } = makeFilters({ statuses: ["draft", "active"], visibilities: ["public"] });
    render(<ListFilterMenu filters={filters} labels={labels} />);

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("3");
    expect(button).toHaveAccessibleName("Filter 3 selected");
  });

  it("lists one row per filter without a search box", async () => {
    const user = userEvent.setup();
    render(<ListFilterMenu filters={makeFilters().filters} labels={labels} />);

    await user.click(screen.getByRole("button", { name: "Filter" }));

    const rows = screen.getByRole("listbox", { name: "Filter" });
    expect(
      within(rows)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Status", "Visibility"]);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("opens a filter's values as a checkbox list without a search box", async () => {
    const user = userEvent.setup();
    const { filters } = makeFilters({ statuses: ["active"] });
    render(<ListFilterMenu filters={filters} labels={labels} />);

    await user.click(screen.getByRole("button", { name: /Filter/ }));
    await user.click(screen.getByRole("option", { name: "Status" }));

    const values = screen.getByRole("listbox", { name: "Status" });
    expect(within(values).getByRole("option", { name: "Draft" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(within(values).getByRole("option", { name: "Active" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("adds a picked value in option order and keeps the menu open", async () => {
    const user = userEvent.setup();
    const { filters, onStatuses } = makeFilters({ statuses: ["published"] });
    render(<ListFilterMenu filters={filters} labels={labels} />);

    await user.click(screen.getByRole("button", { name: /Filter/ }));
    await user.click(screen.getByRole("option", { name: "Status" }));
    await user.click(screen.getByRole("option", { name: "Draft" }));

    expect(onStatuses).toHaveBeenCalledWith(["draft", "published"]);
    expect(screen.getByRole("option", { name: "Visibility" })).toBeInTheDocument();
  });

  it("removes a value that was already picked", async () => {
    const user = userEvent.setup();
    const { filters, onStatuses } = makeFilters({ statuses: ["draft", "active"] });
    render(<ListFilterMenu filters={filters} labels={labels} />);

    await user.click(screen.getByRole("button", { name: /Filter/ }));
    await user.click(screen.getByRole("option", { name: "Status" }));
    await user.click(screen.getByRole("option", { name: "Draft" }));

    expect(onStatuses).toHaveBeenCalledWith(["active"]);
  });

  it("switches the value list when another filter is chosen", async () => {
    const user = userEvent.setup();
    render(<ListFilterMenu filters={makeFilters().filters} labels={labels} />);

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(screen.getByRole("option", { name: "Status" }));
    await user.click(screen.getByRole("option", { name: "Visibility" }));

    expect(screen.queryByRole("listbox", { name: "Status" })).not.toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Visibility" })).toBeInTheDocument();
  });

  it("picks values from the keyboard", async () => {
    const user = userEvent.setup();
    const { filters, onStatuses } = makeFilters();
    render(<ListFilterMenu filters={filters} labels={labels} />);

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onStatuses).toHaveBeenCalledWith(["active"]);
  });
});

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
