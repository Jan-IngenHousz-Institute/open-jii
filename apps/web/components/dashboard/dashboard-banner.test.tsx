import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { DashboardBanner } from "./dashboard-banner";

const baseProps = {
  title: "Welcome",
  description: "Continue your research.",
  buttonLabel: "Transfer",
  buttonHref: "/en/platform/transfer",
  locale: "en",
};

describe("DashboardBanner", () => {
  it("renders title, description, and button link", () => {
    render(<DashboardBanner {...baseProps} />);

    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByText("Continue your research.")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/en/platform/transfer");
    expect(screen.getByText("Transfer")).toBeInTheDocument();
  });

  it("omits button when label or href is missing", () => {
    render(<DashboardBanner {...baseProps} buttonLabel={undefined} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders italic description link when provided", () => {
    render(
      <DashboardBanner
        {...baseProps}
        descriptionItalic="Read more"
        descriptionItalicHref="https://example.com"
      />,
    );

    const link = screen.getByRole("link", { name: "Read more" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders secondary button that opens in new tab", () => {
    render(
      <DashboardBanner
        {...baseProps}
        secondaryButtonLabel="Docs"
        secondaryButtonHref="https://docs.example.com"
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    const docsLink = screen.getByRole("link", { name: "Docs" });
    expect(docsLink).toHaveAttribute("target", "_blank");
    expect(docsLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("omits secondary button when label or href is missing", () => {
    render(<DashboardBanner {...baseProps} secondaryButtonLabel="Docs" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
