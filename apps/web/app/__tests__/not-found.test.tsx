import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import NotFound from "../not-found";

describe("NotFound", () => {
  it("renders 404 page with error messages and navigation links", async () => {
    render(await NotFound());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("errors.notFoundTitle");
    expect(screen.getByText("errors.notFoundHeading")).toBeInTheDocument();
    expect(screen.getByText("errors.goToHomepage")).toBeInTheDocument();
    expect(screen.getByText("errors.accessPlatform")).toBeInTheDocument();
    expect(screen.getByText("errors.learnAboutUs")).toBeInTheDocument();
  });
});
