import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { Command, CommandList } from "@repo/ui/components/command";

import { CategoricalOption } from "./categorical-option";

function renderInCommand(ui: React.ReactElement) {
  return render(
    <Command>
      <CommandList>{ui}</CommandList>
    </Command>,
  );
}

describe("CategoricalOption", () => {
  it("renders the raw value as plain text by default", () => {
    renderInCommand(
      <CategoricalOption
        optionValue="alpha"
        isSelected={false}
        isContributor={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("alpha")).toBeInTheDocument();
  });

  it("invokes onSelect when the option is clicked", async () => {
    const onSelect = vi.fn();
    renderInCommand(
      <CategoricalOption
        optionValue="alpha"
        isSelected={false}
        isContributor={false}
        onSelect={onSelect}
      />,
    );
    await userEvent.setup().click(screen.getByRole("option"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders the contributor identity for CONTRIBUTOR columns", () => {
    const struct = JSON.stringify({ id: "u-1", name: "Alice", avatar: null });
    renderInCommand(
      <CategoricalOption
        optionValue={struct}
        isSelected={false}
        isContributor
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
});
