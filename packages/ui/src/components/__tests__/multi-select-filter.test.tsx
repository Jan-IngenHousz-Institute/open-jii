import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MultiSelectFilter } from "../multi-select-filter";

Element.prototype.scrollIntoView = vi.fn();

const options = [
  { value: "active", label: "Active" },
  { value: "stale", label: "Stale" },
  { value: "published", label: "Published" },
] as const;

type Status = (typeof options)[number]["value"];

function renderFilter(props: { selected?: Status[]; onChange?: (values: Status[]) => void } = {}) {
  const onChange = props.onChange ?? vi.fn();
  render(
    <MultiSelectFilter
      title="Status"
      options={options}
      selected={props.selected ?? []}
      onChange={onChange}
      emptyLabel="No matches"
      selectedCountLabel={(count) => `${count} selected`}
    />,
  );
  return { onChange };
}

async function open() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Status/ }));
  return user;
}

describe("MultiSelectFilter", () => {
  it("shows only the title while nothing is picked", () => {
    renderFilter();

    const button = screen.getByRole("button");
    expect(button).toHaveAccessibleName("Status");
    expect(button).toHaveTextContent(/^Status$/);
  });

  it("counts the picked values on the button", () => {
    renderFilter({ selected: ["active", "published"] });

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("2");
    expect(button).toHaveAccessibleName("Status 2 selected");
  });

  it("lists every option with its picked state", async () => {
    renderFilter({ selected: ["stale"] });
    await open();

    expect(screen.getByRole("option", { name: "Active" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("option", { name: "Stale" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByPlaceholderText("Status")).toBeInTheDocument();
  });

  it("adds a value in option order", async () => {
    const { onChange } = renderFilter({ selected: ["published"] });
    const user = await open();

    await user.click(screen.getByRole("option", { name: "Active" }));

    expect(onChange).toHaveBeenCalledWith(["active", "published"]);
  });

  it("removes a picked value", async () => {
    const { onChange } = renderFilter({ selected: ["active", "stale"] });
    const user = await open();

    await user.click(screen.getByRole("option", { name: "Active" }));

    expect(onChange).toHaveBeenCalledWith(["stale"]);
  });

  it("narrows the options by search and says when none match", async () => {
    renderFilter();
    const user = await open();

    await user.type(screen.getByPlaceholderText("Status"), "pub");
    expect(screen.getByRole("option", { name: "Published" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Active" })).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Status"), "zzz");
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("uses a custom search placeholder and works without the optional labels", async () => {
    render(
      <MultiSelectFilter
        title="Visibility"
        options={[{ value: "public", label: "Public" }]}
        selected={["public"]}
        onChange={vi.fn()}
        searchPlaceholder="Find visibility"
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Visibility/ }));

    expect(screen.getByPlaceholderText("Find visibility")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Find visibility"), "zzz");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});
