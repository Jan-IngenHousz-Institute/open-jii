import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import NewProtocolPage from "./page";

vi.mock("@/components/new-protocol", () => ({
  NewProtocolForm: () => <div data-testid="new-protocol-form">New Protocol Form</div>,
}));

const defaultProps = { params: Promise.resolve({ locale: "en-US" }) };

describe("NewProtocolPage", () => {
  it("renders title, description, and form", async () => {
    render(await NewProtocolPage(defaultProps));

    expect(screen.getByText("protocols.newProtocol")).toBeInTheDocument();
    expect(screen.getByText("newProtocol.description")).toBeInTheDocument();
    expect(screen.getByTestId("new-protocol-form")).toBeInTheDocument();
  });
});
