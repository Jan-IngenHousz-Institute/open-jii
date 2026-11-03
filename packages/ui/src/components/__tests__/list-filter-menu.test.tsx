import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ListFilterMenu } from "../list-filter-menu";
import { labels, makeFilters } from "./list-filter-fixtures";

Element.prototype.scrollIntoView = vi.fn();

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
