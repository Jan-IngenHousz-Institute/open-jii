import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ExperimentDataTableErrorCell } from "./experiment-data-table-error-cell";

describe("ExperimentDataTableErrorCell", () => {
  it("should not render anything when error is null", () => {
    const { container } = render(<ExperimentDataTableErrorCell error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("should not render anything when error is undefined", () => {
    const { container } = render(<ExperimentDataTableErrorCell error={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("should not render anything when error is empty string", () => {
    const { container } = render(<ExperimentDataTableErrorCell error="" />);
    expect(container.firstChild).toBeNull();
  });

  it("should render error button when error is provided", () => {
    render(<ExperimentDataTableErrorCell error="Test error message" />);
    expect(screen.getByRole("button", { name: /view error details/i })).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("should show error message in popover when clicked", async () => {
    const user = userEvent.setup();
    const errorMessage = "This is a test error message";

    render(<ExperimentDataTableErrorCell error={errorMessage} />);

    const button = screen.getByRole("button", { name: /view error details/i });
    await user.click(button);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("should handle long error messages", async () => {
    const user = userEvent.setup();
    const longError = "A".repeat(500);

    render(<ExperimentDataTableErrorCell error={longError} />);

    const button = screen.getByRole("button", { name: /view error details/i });
    await user.click(button);

    expect(screen.getByText(longError)).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <ExperimentDataTableErrorCell error="Test error" className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
