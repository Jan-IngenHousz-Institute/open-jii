import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "~/test/test-utils";

import NotFound from "../not-found";

describe("the not found page", () => {
  it("says the page does not exist and links to the status page", () => {
    renderWithProviders(<NotFound />);

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the current status" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
