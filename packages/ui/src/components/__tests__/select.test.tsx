import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";

Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

describe("SelectItem descriptions", () => {
  it("shows secondary text inside its option while keeping the selected trigger concise", async () => {
    const user = userEvent.setup();
    render(
      <Select defaultValue="none">
        <SelectTrigger aria-label="Aggregate">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          <SelectItem
            value="previous"
            description="Keeps every row"
            descriptionId="previous-reason"
          >
            Previous value
          </SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "Aggregate" });
    await user.click(trigger);
    const option = screen.getByRole("option", { name: "Previous value" });
    const description = screen.getByText("Keeps every row");
    expect(description).toBeVisible();
    expect(option).toContainElement(description);
    expect(option).toHaveAccessibleDescription("Keeps every row");
    await user.click(option);
    expect(trigger).toHaveTextContent("Previous value");
    expect(trigger).not.toHaveTextContent("Keeps every row");
  });
});
