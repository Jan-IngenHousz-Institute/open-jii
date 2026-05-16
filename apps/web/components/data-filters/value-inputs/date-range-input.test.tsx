import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { DateRangeInput } from "./date-range-input";

describe("DateRangeInput", () => {
  it("shows the pick-range placeholder when there's no value", () => {
    render(<DateRangeInput value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "dataFilters.pickRange" })).toBeInTheDocument();
  });

  it("renders both bounds in the trigger label when a tuple is set", () => {
    render(
      <DateRangeInput
        value={["2025-01-01T00:00:00.000Z", "2025-01-07T23:59:00.000Z"]}
        onChange={vi.fn()}
      />,
    );
    // formatYmdHm uses local time, so we just assert the arrow separator.
    expect(screen.getByRole("button", { name: /→/ })).toBeInTheDocument();
  });

  it("renders an empty-bound placeholder when only one bound is set", () => {
    render(<DateRangeInput value={["2025-01-01T00:00:00.000Z", ""]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /…/ })).toBeInTheDocument();
  });

  it("opens the preset list and emits a tuple when a preset is picked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateRangeInput value={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "dataFilters.pickRange" }));
    await user.click(screen.getByRole("button", { name: "dataFilters.presetLast24h" }));

    expect(onChange).toHaveBeenLastCalledWith([expect.any(String), expect.any(String)]);
  });

  it("disables the time inputs when no start/end is set", async () => {
    const user = userEvent.setup();
    render(<DateRangeInput value={[]} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "dataFilters.pickRange" }));

    const timeInputs = screen.getAllByDisplayValue(/^(\d{2}:\d{2}|00:00|23:59)$/);
    for (const input of timeInputs) {
      expect(input).toBeDisabled();
    }
  });

  it("emits a new tuple when the start time of day is edited", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DateRangeInput
        value={["2025-01-01T00:00:00.000Z", "2025-01-07T23:59:00.000Z"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /→/ }));
    // First time input is the "from" bound; both bounds enabled when set.
    const timeInputs = screen.getAllByDisplayValue(/^\d{2}:\d{2}$/);
    expect(timeInputs[0]).not.toBeDisabled();
    await user.clear(timeInputs[0]);
    await user.type(timeInputs[0], "09:15");

    expect(onChange).toHaveBeenLastCalledWith([expect.any(String), expect.any(String)]);
  });

  it("emits a new tuple when the end time of day is edited", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DateRangeInput
        value={["2025-01-01T00:00:00.000Z", "2025-01-07T23:59:00.000Z"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /→/ }));
    const timeInputs = screen.getAllByDisplayValue(/^\d{2}:\d{2}$/);
    await user.clear(timeInputs[1]);
    await user.type(timeInputs[1], "17:45");

    expect(onChange).toHaveBeenLastCalledWith([expect.any(String), expect.any(String)]);
  });

  it("treats a non-array value as unset (defensive parseRange path)", () => {
    // The DataFilterValue type also accepts scalars; the range input should
    // simply display the pick-range placeholder rather than crash.
    render(<DateRangeInput value="" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "dataFilters.pickRange" })).toBeInTheDocument();
  });
});
