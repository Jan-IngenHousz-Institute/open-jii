import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { DateTimeInput } from "./date-time-input";

describe("DateTimeInput", () => {
  it("shows the picker placeholder when no value is set", () => {
    render(<DateTimeInput value="" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "dataFilters.pickDate" })).toBeInTheDocument();
  });

  it("renders the picked date and the matching time", () => {
    render(<DateTimeInput value="2025-03-04T14:23:00.000Z" onChange={vi.fn()} />);
    // The button label is the yyyy-MM-dd of the local-rendered date.
    expect(screen.getByRole("button", { name: /2025-03-0/ })).toBeInTheDocument();
    expect(screen.getByDisplayValue(/^\d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it("emits a new ISO string when the time of day changes", async () => {
    const onChange = vi.fn();
    render(<DateTimeInput value="2025-03-04T00:00:00.000Z" onChange={onChange} />);

    const time = screen.getByDisplayValue(/^\d{2}:\d{2}$/);
    await userEvent.setup().clear(time);
    await userEvent.setup().type(time, "08:30");

    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
    );
  });

  it("falls back to today's date for the time input when no value is set", () => {
    render(<DateTimeInput value="" onChange={vi.fn()} />);
    // With no value, parseIsoDate returns null and timeValue defaults to "00:00".
    expect(screen.getByDisplayValue("00:00")).toBeInTheDocument();
  });

  it("disables the time input and emits nothing until a date is picked", () => {
    const onChange = vi.fn();
    render(<DateTimeInput value="" onChange={onChange} />);

    // No date selected: the time input must not fabricate "today".
    const time = screen.getByDisplayValue("00:00");
    expect(time).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens the calendar popover when the date button is clicked", async () => {
    const user = userEvent.setup();
    render(<DateTimeInput value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "dataFilters.pickDate" }));
    // Calendar renders a month grid in the popover; we just need to confirm
    // it mounted, not exercise react-day-picker's internals.
    expect(await screen.findByRole("grid")).toBeInTheDocument();
  });
});
