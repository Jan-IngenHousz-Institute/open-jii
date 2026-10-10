import { render, screen, userEvent } from "@/test/test-utils";
import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as SelectModule from "@repo/ui/components/select";

import { CellPickerSelect } from "./cell-picker-select";

const itemRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock("@repo/ui/components/select", async () => {
  const actual = await vi.importActual<typeof SelectModule>("@repo/ui/components/select");

  function CountedSelectItem(props: ComponentProps<typeof actual.SelectItem>) {
    itemRenders.count += 1;
    return <actual.SelectItem {...props} />;
  }

  return { ...actual, SelectItem: CountedSelectItem };
});

const options = [
  { value: "cell-1", label: "Protocol (Light sensor)" },
  { value: "cell-2", label: "Command (battery)" },
];

describe("CellPickerSelect", () => {
  beforeEach(() => {
    itemRenders.count = 0;
  });

  it("shows the selected cell's label without mounting the options", () => {
    render(
      <CellPickerSelect
        value="cell-2"
        onValueChange={vi.fn()}
        options={options}
        placeholder="source..."
        triggerClassName=""
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Command (battery)");
    expect(itemRenders.count).toBe(0);
  });

  it("shows the placeholder when nothing is selected", () => {
    render(
      <CellPickerSelect
        value={undefined}
        onValueChange={vi.fn()}
        options={options}
        placeholder="source..."
        triggerClassName=""
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("source...");
  });

  it("mounts the options when opened and reports the choice", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <CellPickerSelect
        value={undefined}
        onValueChange={onValueChange}
        options={options}
        placeholder="source..."
        triggerClassName=""
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Protocol (Light sensor)" }));

    expect(itemRenders.count).toBeGreaterThan(0);
    expect(onValueChange).toHaveBeenCalledWith("cell-1");
  });
});
