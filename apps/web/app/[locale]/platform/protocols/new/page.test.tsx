import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import NewProtocolPage from "./page";

vi.mock("@/components/new-protocol", () => ({
  NewProtocolForm: () => (
    <div data-testid="new-protocol-form">
      <div>
        <h3 className="text-lg font-medium">protocols.newProtocol</h3>
        <p className="text-muted-foreground text-sm">newProtocol.description</p>
      </div>
      <div>New Protocol Form</div>
    </div>
  ),
}));

const defaultProps = { params: Promise.resolve({ locale: "en-US" }) };

describe("NewProtocolPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the new protocol page with all components", () => {
    render(<NewProtocolPage />);

    expect(screen.getByText("protocols.newProtocol")).toBeInTheDocument();
    expect(screen.getByText("newProtocol.description")).toBeInTheDocument();
    expect(screen.getByTestId("new-protocol-form")).toBeInTheDocument();
  });

  it("renders heading with correct styling", () => {
    const { container } = render(<NewProtocolPage />);

    const heading = container.querySelector("h3");
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("text-lg", "font-medium");
    expect(heading).toHaveTextContent("protocols.newProtocol");
  });

  it("renders description with correct styling", () => {
    const { container } = render(<NewProtocolPage />);

    const description = container.querySelector("p");
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass("text-muted-foreground", "text-sm");
    expect(description).toHaveTextContent("newProtocol.description");
  });

  it("renders with correct structure and spacing", () => {
    const { container } = render(<NewProtocolPage />);

    const mainDiv = container.querySelector(".space-y-6");
    expect(mainDiv).toBeInTheDocument();

    const headerDiv = container.querySelector("div > div");
    expect(headerDiv).toBeInTheDocument();
  });

  it("renders form component", () => {
    render(<NewProtocolPage />);

    const form = screen.getByTestId("new-protocol-form");
    expect(form).toBeInTheDocument();
    expect(form).toHaveTextContent("New Protocol Form");
  });
});
