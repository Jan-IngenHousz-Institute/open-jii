import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import Page from "./page";

vi.mock("./new-organization-content", () => ({
  default: () => <div data-testid="new-organization-form" />,
}));

describe("NewOrganizationPage", () => {
  it("renders the creation heading, its description and the wizard", async () => {
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));

    // The same modest heading the other creation routes use, not a listing's page title.
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "organizations.createAction",
    );
    expect(screen.getByText("organizations.listDescription")).toBeInTheDocument();
    expect(screen.getByTestId("new-organization-form")).toBeInTheDocument();
  });
});
