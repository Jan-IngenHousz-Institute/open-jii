import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { DataTableErrorCell } from "./data-table-error-cell";

describe("DataTableErrorCell", () => {
  it("should not render anything when error is null", () => {
    const { container } = render(<DataTableErrorCell error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("should not render anything when error is undefined", () => {
    const { container } = render(<DataTableErrorCell error={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("should not render anything when error is empty string", () => {
    const { container } = render(<DataTableErrorCell error="" />);
    expect(container.firstChild).toBeNull();
  });

  it("should render error button when error is provided", () => {
    render(<DataTableErrorCell error="Test error message" />);
    expect(screen.getByRole("button", { name: /view error details/i })).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("should show error message in popover when clicked", async () => {
    const user = userEvent.setup();
    const errorMessage = "This is a test error message";

    render(<DataTableErrorCell error={errorMessage} />);

    const button = screen.getByRole("button", { name: /view error details/i });
    await user.click(button);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("should handle long error messages", async () => {
    const user = userEvent.setup();
    const longError = "A".repeat(500);

    render(<DataTableErrorCell error={longError} />);

    const button = screen.getByRole("button", { name: /view error details/i });
    await user.click(button);

    expect(screen.getByText(longError)).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <DataTableErrorCell error="Test error" className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
