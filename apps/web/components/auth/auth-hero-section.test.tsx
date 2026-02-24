import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { AuthHeroSection } from "./auth-hero-section";

describe("AuthHeroSection", () => {
  it("renders hero title and description", async () => {
    render(await AuthHeroSection({ locale: "en-US" }));

    expect(screen.getByText("auth.heroDescription")).toBeInTheDocument();
  });

  it("renders openJII logo and powered-by text", async () => {
    render(await AuthHeroSection({ locale: "en-US" }));

    expect(screen.getByAltText("openJII Logo")).toBeInTheDocument();
    expect(screen.getByText("auth.poweredBy")).toBeInTheDocument();
  });

  it("renders institute logo with correct dimensions", async () => {
    render(await AuthHeroSection({ locale: "en-US" }));

    const logo = screen.getByAltText("auth.instituteAlt");
    expect(logo).toHaveAttribute("width", "140");
    expect(logo).toHaveAttribute("height", "28");
  });
});
