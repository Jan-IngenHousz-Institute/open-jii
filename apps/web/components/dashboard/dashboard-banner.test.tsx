import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { DashboardBanner } from "./dashboard-banner";

globalThis.React = React;

// ---- Mocks ----

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    locale,
    className,
    target,
    rel,
  }: {
    children: React.ReactNode;
    href: string;
    locale?: string;
    className?: string;
    target?: string;
    rel?: string;
  }) => (
    <a
      href={href}
      data-locale={locale}
      className={className}
      target={target}
      rel={rel}
      data-testid="next-link"
    >
      {children}
    </a>
  ),
}));

// Mock Button component from @repo/ui
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <button className={className} data-testid="button">
      {children}
    </button>
  ),
}));

// ---- Tests ----

describe("<DashboardBanner />", () => {
  const defaultProps = {
    title: "Welcome to openJII",
    description: "Continue your research without interruption, transfer your data now.",
    buttonLabel: "Request Project Transfer",
    buttonHref: "/en/platform/transfer-request",
    locale: "en",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Content Rendering", () => {
    it("renders the title correctly", () => {
      render(<DashboardBanner {...defaultProps} />);

      const title = screen.getByText(defaultProps.title);
      expect(title).toBeInTheDocument();
      expect(title.tagName).toBe("H2");
    });

    it("renders the description correctly", () => {
      render(<DashboardBanner {...defaultProps} />);

      const description = screen.getByText(defaultProps.description);
      expect(description).toBeInTheDocument();
      expect(description.tagName).toBe("P");
    });

    it("renders the button with correct label", () => {
      render(<DashboardBanner {...defaultProps} />);

      const button = screen.getByTestId("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent(defaultProps.buttonLabel);
    });

    it("does not render button when buttonLabel is not provided", () => {
      render(<DashboardBanner {...defaultProps} buttonLabel={undefined} />);

      expect(screen.queryByTestId("button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("next-link")).not.toBeInTheDocument();
    });

    it("does not render button when buttonHref is not provided", () => {
      render(<DashboardBanner {...defaultProps} buttonHref={undefined} />);

      expect(screen.queryByTestId("button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("next-link")).not.toBeInTheDocument();
    });

    it("renders without button when both are omitted", () => {
      render(<DashboardBanner {...defaultProps} buttonLabel={undefined} buttonHref={undefined} />);

      expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
      expect(screen.getByText(defaultProps.description)).toBeInTheDocument();
      expect(screen.queryByTestId("button")).not.toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("renders a link with the provided buttonHref", () => {
      render(<DashboardBanner {...defaultProps} />);

      const link = screen.getByTestId("next-link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/en/platform/transfer-request");
    });

    it("passes the locale prop to the link", () => {
      render(
        <DashboardBanner
          {...defaultProps}
          locale="de"
          buttonHref="/de/platform/transfer-request"
        />,
      );

      const link = screen.getByTestId("next-link");
      expect(link).toHaveAttribute("data-locale", "de");
      expect(link).toHaveAttribute("href", "/de/platform/transfer-request");
    });

    it("constructs the correct href with different locales", () => {
      const { rerender } = render(
        <DashboardBanner
          {...defaultProps}
          locale="en-US"
          buttonHref="/en-US/platform/transfer-request"
        />,
      );
      expect(screen.getByTestId("next-link")).toHaveAttribute(
        "href",
        "/en-US/platform/transfer-request",
      );

      rerender(
        <DashboardBanner
          {...defaultProps}
          locale="de-DE"
          buttonHref="/de-DE/platform/transfer-request"
        />,
      );
      expect(screen.getByTestId("next-link")).toHaveAttribute(
        "href",
        "/de-DE/platform/transfer-request",
      );
    });

    it("renders custom buttonHref", () => {
      const customHref = "/en/custom/path";
      render(<DashboardBanner {...defaultProps} buttonHref={customHref} />);

      const link = screen.getByTestId("next-link");
      expect(link).toHaveAttribute("href", customHref);
    });
  });

  describe("Props Handling", () => {
    it("renders with custom title", () => {
      const customTitle = "Custom Welcome Message";
      render(<DashboardBanner {...defaultProps} title={customTitle} />);

      expect(screen.getByText(customTitle)).toBeInTheDocument();
      expect(screen.queryByText(defaultProps.title)).not.toBeInTheDocument();
    });

    it("renders with custom description", () => {
      const customDescription = "This is a custom description for testing.";
      render(<DashboardBanner {...defaultProps} description={customDescription} />);

      expect(screen.getByText(customDescription)).toBeInTheDocument();
      expect(screen.queryByText(defaultProps.description)).not.toBeInTheDocument();
    });

    it("renders with custom button label", () => {
      const customLabel = "Start Transfer Now";
      render(<DashboardBanner {...defaultProps} buttonLabel={customLabel} />);

      expect(screen.getByText(customLabel)).toBeInTheDocument();
      expect(screen.queryByText(defaultProps.buttonLabel)).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("uses semantic HTML with heading element", () => {
      render(<DashboardBanner {...defaultProps} />);

      const heading = screen.getByRole("heading", { name: defaultProps.title });
      expect(heading).toBeInTheDocument();
    });

    it("has a clickable button inside a link", () => {
      render(<DashboardBanner {...defaultProps} />);

      const button = screen.getByRole("button", { name: defaultProps.buttonLabel });
      expect(button).toBeInTheDocument();
    });

    it("has proper link with href attribute", () => {
      render(<DashboardBanner {...defaultProps} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/en/platform/transfer-request");
    });
  });

  describe("Edge Cases", () => {
    it("renders structure without button when label is empty", () => {
      render(<DashboardBanner {...defaultProps} title="" description="" buttonLabel="" />);

      // Empty button label means no button should render
      expect(screen.queryByTestId("next-link")).not.toBeInTheDocument();
      expect(screen.queryByTestId("button")).not.toBeInTheDocument();
    });

    it("handles very long text content", () => {
      const longTitle = "A".repeat(200);
      const longDescription = "B".repeat(500);
      const longButtonLabel = "C".repeat(100);

      render(
        <DashboardBanner
          {...defaultProps}
          title={longTitle}
          description={longDescription}
          buttonLabel={longButtonLabel}
        />,
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
      expect(screen.getByText(longDescription)).toBeInTheDocument();
      expect(screen.getByText(longButtonLabel)).toBeInTheDocument();
    });

    it("handles special characters in text", () => {
      const specialTitle = "Welcome <>&\"' to openJII";
      const specialDescription = 'Transfer & continue <your> research "now"';

      render(
        <DashboardBanner {...defaultProps} title={specialTitle} description={specialDescription} />,
      );

      expect(screen.getByText(specialTitle)).toBeInTheDocument();
      expect(screen.getByText(specialDescription)).toBeInTheDocument();
    });

    it("renders with provided href regardless of locale", () => {
      render(<DashboardBanner {...defaultProps} locale="fr-FR" />);
      // buttonHref is explicitly provided, so it uses that value
      expect(screen.getByTestId("next-link")).toHaveAttribute(
        "href",
        "/en/platform/transfer-request",
      );
    });
  });

  describe("Secondary Button", () => {
    it("renders secondary button when props are provided", () => {
      render(
        <DashboardBanner
          {...defaultProps}
          secondaryButtonLabel="Report Bug"
          secondaryButtonHref="https://docs.example.com"
        />,
      );

      expect(screen.getByText("Report Bug")).toBeInTheDocument();
    });

    it("renders both buttons when both sets of props are provided", () => {
      render(
        <DashboardBanner
          {...defaultProps}
          secondaryButtonLabel="Report Bug"
          secondaryButtonHref="https://docs.example.com"
        />,
      );

      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(2);
      expect(screen.getByText("Report Bug")).toBeInTheDocument();
      expect(screen.getByText(defaultProps.buttonLabel)).toBeInTheDocument();
    });

    it("opens secondary button in new tab", () => {
      render(
        <DashboardBanner
          {...defaultProps}
          secondaryButtonLabel="Report Bug"
          secondaryButtonHref="https://docs.example.com"
        />,
      );

      const link = screen.getByRole("link", { name: "Report Bug" });

      expect(link).toHaveAttribute("href", "https://docs.example.com");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("does not render secondary button when label is missing", () => {
      render(<DashboardBanner {...defaultProps} secondaryButtonHref="https://docs.example.com" />);

      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(1); // Only primary button
    });

    it("does not render secondary button when href is missing", () => {
      render(<DashboardBanner {...defaultProps} secondaryButtonLabel="Report Bug" />);

      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(1); // Only primary button
    });
  });
});
