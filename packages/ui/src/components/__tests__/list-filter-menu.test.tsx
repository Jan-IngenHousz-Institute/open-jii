import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("marks the filter rows as opening a list without aria-expanded on an option", async () => {
    const user = userEvent.setup();
    render(<ListFilterMenu filters={makeFilters().filters} labels={labels} />);

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(screen.getByRole("option", { name: "Status" }));

    const row = within(screen.getByRole("listbox", { name: "Filter" })).getByRole("option", {
      name: "Status",
    });
    expect(row).toHaveAttribute("aria-haspopup", "listbox");
    expect(row).not.toHaveAttribute("aria-expanded");
  });

  it("opens a filter's values with ArrowRight and closes them with ArrowLeft", async () => {
    const user = userEvent.setup();
    render(<ListFilterMenu filters={makeFilters().filters} labels={labels} />);

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("listbox", { name: "Status" })).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(screen.queryByRole("listbox", { name: "Status" })).not.toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Filter" })).toBeInTheDocument();
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

describe("ListFilterMenu on a phone", () => {
  const desktop = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = (query: string) =>
      ({
        matches: query.includes("max-width"),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;
  });

  afterEach(() => {
    window.matchMedia = desktop;
  });

  it("replaces the list of filters with the chosen filter's values and a back row", async () => {
    const user = userEvent.setup();
    const { filters, onStatuses } = makeFilters();
    render(<ListFilterMenu filters={filters} labels={labels} />);

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(screen.getByRole("option", { name: "Status" }));

    expect(screen.queryByRole("listbox", { name: "Filter" })).not.toBeInTheDocument();
    const values = screen.getByRole("listbox", { name: "Status" });
    await user.click(within(values).getByRole("option", { name: "Active" }));
    expect(onStatuses).toHaveBeenCalledWith(["active"]);

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.queryByRole("listbox", { name: "Status" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Visibility" })).toBeInTheDocument();
  });

  it("goes back to the list of filters with ArrowLeft", async () => {
    const user = userEvent.setup();
    render(<ListFilterMenu filters={makeFilters().filters} labels={labels} />);

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("listbox", { name: "Status" })).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("listbox", { name: "Filter" })).toBeInTheDocument();
  });
});
