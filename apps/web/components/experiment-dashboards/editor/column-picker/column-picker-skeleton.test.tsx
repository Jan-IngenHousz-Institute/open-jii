import { render } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ColumnPickerSkeleton } from "./column-picker-skeleton";

describe("ColumnPickerSkeleton", () => {
  it("renders five placeholder rows plus the add-column placeholder", () => {
    const { container } = render(<ColumnPickerSkeleton />);
    const rows = container.querySelectorAll("div.flex.h-8");
    expect(rows.length).toBe(5);
  });

  it("is marked aria-hidden so screen readers skip the placeholder", () => {
    const { container } = render(<ColumnPickerSkeleton />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute("aria-hidden");
  });
});
