import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ErrorContent } from "./error-content";

describe("ErrorContent", () => {
  it("renders error title and default description", () => {
    render(<ErrorContent locale="en-US" />);

    expect(screen.getByText("auth.errorTitle")).toBeInTheDocument();
    expect(screen.getByText("auth.errorDescription")).toBeInTheDocument();
  });

  it("renders custom error description when provided", () => {
    render(<ErrorContent locale="en-US" errorDescription="Custom error" />);

    expect(screen.getByText("Custom error")).toBeInTheDocument();
    expect(screen.queryByText("auth.errorDescription")).not.toBeInTheDocument();
  });

  it("renders error code when provided", () => {
    render(<ErrorContent locale="en-US" error="oauth_error" />);

    expect(screen.getByText("Error: oauth_error")).toBeInTheDocument();
  });

  it("does not render error code when omitted", () => {
    render(<ErrorContent locale="en-US" />);

    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
  });

  it("renders action links with correct hrefs", () => {
    render(<ErrorContent locale="en-US" />);

    expect(screen.getByRole("link", { name: "auth.errorTryAgain" })).toHaveAttribute(
      "href",
      "/en-US/login",
    );
    expect(screen.getByRole("link", { name: "auth.errorGoHome" })).toHaveAttribute(
      "href",
      "/en-US",
    );
    expect(screen.getByText("auth.errorSupport")).toBeInTheDocument();
  });

  it("adapts links to locale", () => {
    render(<ErrorContent locale="de-DE" />);

    expect(screen.getByRole("link", { name: "auth.errorTryAgain" })).toHaveAttribute(
      "href",
      "/de-DE/login",
    );
    expect(screen.getByRole("link", { name: "auth.errorGoHome" })).toHaveAttribute(
      "href",
      "/de-DE",
    );
  });
});
