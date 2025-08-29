import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ProfilePictureCard } from "../profile-picture-card";

globalThis.React = React;
// Mock UI components from @repo/ui/components
vi.mock("@repo/ui/components", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  ),
  CardDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p data-testid="card-description" className={className}>
      {children}
    </p>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  Button: ({
    children,
    type,
    variant: _variant,
    className,
    "aria-disabled": ariaDisabled,
    ...props
  }: {
    children: React.ReactNode;
    type?: string;
    variant?: string;
    className?: string;
    "aria-disabled"?: boolean;
  }) => (
    <button
      data-testid="upload-button"
      type={type as "button" | "submit" | "reset"}
      className={className}
      aria-disabled={ariaDisabled}
      {...props}
    >
      {children}
    </button>
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Upload: ({ className, ...props }: { className?: string }) => (
    <svg data-testid="upload-icon" className={className} {...props}>
      <title>Upload</title>
    </svg>
  ),
  Plus: ({ className, ...props }: { className?: string; "aria-hidden"?: boolean }) => (
    <svg data-testid="plus-icon" className={className} {...props}>
      <title>Plus</title>
    </svg>
  ),
  User: ({ className, ...props }: { className?: string; "aria-hidden"?: boolean }) => (
    <svg data-testid="user-icon" className={className} {...props}>
      <title>User</title>
    </svg>
  ),
}));

describe("<ProfilePictureCard />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the card structure correctly", () => {
    render(<ProfilePictureCard />);

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card-header")).toBeInTheDocument();
    expect(screen.getByTestId("card-content")).toBeInTheDocument();
  });

  it("displays the title with user icon and disabled badge", () => {
    render(<ProfilePictureCard />);

    expect(screen.getByTestId("user-icon")).toBeInTheDocument();
    expect(screen.getByTestId("card-title")).toHaveTextContent("Profile Picture");
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("shows the circular placeholder with plus icon", () => {
    render(<ProfilePictureCard />);

    const plusIcon = screen.getByTestId("plus-icon");
    expect(plusIcon).toBeInTheDocument();
    expect(plusIcon).toHaveClass("h-6", "w-6", "opacity-40");
  });

  it("displays the upload button with upload icon", () => {
    render(<ProfilePictureCard />);

    const uploadButton = screen.getByTestId("upload-button");
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton).toHaveTextContent("Upload New Photo");
    expect(uploadButton).toHaveAttribute("type", "button");
    expect(uploadButton).toHaveAttribute("aria-disabled");

    const uploadIcon = screen.getByTestId("upload-icon");
    expect(uploadIcon).toBeInTheDocument();
  });

  it("shows the file format and size restrictions", () => {
    render(<ProfilePictureCard />);

    expect(screen.getByText("JPG, PNG or GIF. Max size 5MB.")).toBeInTheDocument();
  });

  it("applies correct CSS classes for styling", () => {
    render(<ProfilePictureCard />);

    const card = screen.getByTestId("card");
    expect(card).toHaveClass("h-full");

    const title = screen.getByTestId("card-title");
    expect(title).toHaveClass("text-gray-500");

    const description = screen.getByTestId("card-description");
    expect(description).toHaveClass("text-gray-500");

    const content = screen.getByTestId("card-content");
    expect(content).toHaveClass(
      "flex",
      "flex-col",
      "items-center",
      "justify-center",
      "gap-4",
      "py-8",
    );

    const button = screen.getByTestId("upload-button");
    expect(button).toHaveClass("gap-2", "text-gray-500");
  });

  it("button is not clickable due to disabled state", async () => {
    const user = userEvent.setup();
    render(<ProfilePictureCard />);

    const uploadButton = screen.getByTestId("upload-button");
    expect(uploadButton).toHaveAttribute("aria-disabled");

    await user.click(uploadButton);
  });

  it("renders all visual elements in the correct hierarchy", () => {
    render(<ProfilePictureCard />);

    // Check that the card contains both header and content
    const card = screen.getByTestId("card");
    const header = screen.getByTestId("card-header");
    const content = screen.getByTestId("card-content");

    expect(card).toContainElement(header);
    expect(card).toContainElement(content);

    // Check that content contains the circular placeholder and button
    const button = screen.getByTestId("upload-button");
    expect(content).toContainElement(button);
  });

  it("displays proper accessibility attributes", () => {
    render(<ProfilePictureCard />);

    const userIcon = screen.getByTestId("user-icon");
    expect(userIcon).toHaveAttribute("aria-hidden");

    const plusIcon = screen.getByTestId("plus-icon");
    expect(plusIcon).toHaveAttribute("aria-hidden");

    const uploadButton = screen.getByTestId("upload-button");
    expect(uploadButton).toHaveAttribute("aria-disabled");
  });
});
