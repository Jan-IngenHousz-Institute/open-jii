import { render, screen } from "@/test/test-utils";
import { RadioReceiver } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("renders the icon inside the muted circle", () => {
    const { container } = render(<EmptyState icon={RadioReceiver} title="Nothing here" />);

    const circle = container.querySelector(".bg-muted.rounded-full");
    expect(circle).toHaveClass("size-24");
    expect(circle?.querySelector("svg")).toHaveClass("size-12", "text-muted-foreground");
  });

  it("renders title, description and actions", () => {
    render(
      <EmptyState icon={RadioReceiver} title="No devices" description="Register one to start">
        <button type="button">Register</button>
      </EmptyState>,
    );

    expect(screen.getByRole("heading", { name: "No devices" })).toBeInTheDocument();
    expect(screen.getByText("Register one to start")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
  });

  it("wraps in a card by default", () => {
    const { container } = render(<EmptyState icon={RadioReceiver} title="No devices" />);
    expect(container.firstElementChild).toHaveClass("bg-card", "shadow-none");
  });

  it("drops the card when card is false, and forwards the class to the body", () => {
    const { container } = render(
      <EmptyState icon={RadioReceiver} title="No data" card={false} className="mt-6" />,
    );

    const root = container.firstElementChild;
    expect(root).not.toHaveClass("bg-card");
    expect(root).toHaveClass("mt-6", "py-12");
  });

  it("omits the heading when no title is given", () => {
    render(<EmptyState icon={RadioReceiver} description="Only a line" />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Only a line")).toBeInTheDocument();
  });
});
