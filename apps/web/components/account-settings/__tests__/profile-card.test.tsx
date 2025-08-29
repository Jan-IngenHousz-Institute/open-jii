import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import type { UseFormReturn } from "react-hook-form";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateUserProfileBody } from "@repo/api";

import { ProfileCard } from "../profile-card";

globalThis.React = React;

// Mock @repo/ui/components
vi.mock("@repo/ui/components", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="card-title">{children}</h2>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  FormField: ({
    render,
  }: {
    render: (props: {
      field: { value: string; onChange: () => void; onBlur: () => void };
    }) => React.ReactNode;
  }) => render({ field: { value: "", onChange: vi.fn(), onBlur: vi.fn() } }),
  FormItem: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-item">{children}</div>
  ),
  FormLabel: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label data-testid="form-label" className={className}>
      {children}
    </label>
  ),
  FormControl: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-control">{children}</div>
  ),
  FormMessage: () => <div data-testid="form-message" />,
  Input: ({ placeholder, ...props }: { placeholder?: string }) => (
    <input data-testid="input" placeholder={placeholder} {...props} />
  ),
  Textarea: ({ placeholder, rows, ...props }: { placeholder?: string; rows?: number }) => (
    <textarea data-testid="textarea" placeholder={placeholder} rows={rows} {...props} />
  ),
}));

const mockForm = {
  control: {},
} as UseFormReturn<CreateUserProfileBody>;

describe("<ProfileCard />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders card, header, and content", () => {
    render(<ProfileCard form={mockForm} />);
    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card-header")).toBeInTheDocument();
    expect(screen.getByTestId("card-title")).toHaveTextContent("Profile Information");
    expect(screen.getByTestId("card-content")).toBeInTheDocument();
  });

  it("renders first name and last name fields", () => {
    render(<ProfileCard form={mockForm} />);
    const inputs = screen.getAllByTestId("input");
    expect(inputs.find((i) => (i as HTMLInputElement).placeholder === "First Name")).toBeTruthy();
    expect(inputs.find((i) => (i as HTMLInputElement).placeholder === "Last Name")).toBeTruthy();
  });

  it("renders bio textarea", () => {
    render(<ProfileCard form={mockForm} />);
    expect(screen.getByTestId("textarea")).toHaveAttribute("placeholder", "Tell us about yourself");
  });

  it("renders organization field", () => {
    render(<ProfileCard form={mockForm} />);
    const inputs = screen.getAllByTestId("input");
    expect(
      inputs.find((i) => (i as HTMLInputElement).placeholder === "Search or create organization"),
    ).toBeTruthy();
  });

  it("shows disabled professional title and department fields", () => {
    render(<ProfileCard form={mockForm} />);
    const inputs = screen.getAllByTestId("input");
    const titleInput = inputs.find(
      (i) => (i as HTMLInputElement).placeholder === "Your professional title",
    ) as HTMLInputElement | undefined;
    const deptInput = inputs.find(
      (i) => (i as HTMLInputElement).placeholder === "Your department",
    ) as HTMLInputElement | undefined;
    expect(titleInput).toBeTruthy();
    expect(titleInput?.disabled).toBe(true);
    expect(deptInput).toBeTruthy();
    expect(deptInput?.disabled).toBe(true);
    expect(screen.getAllByText("Disabled").length).toBeGreaterThanOrEqual(2);
  });

  it("renders all form labels", () => {
    render(<ProfileCard form={mockForm} />);
    expect(screen.getAllByTestId("form-label").map((l) => l.textContent)).toEqual(
      expect.arrayContaining([
        "First Name",
        "Last Name",
        "Professional Title",
        "Bio",
        "Institution/Organization",
        "Department",
      ]),
    );
  });

  it("renders correct number of FormItem sections", () => {
    render(<ProfileCard form={mockForm} />);
    // 2 for names, 1 for title, 1 for bio, 1 for org, 1 for dept
    expect(screen.getAllByTestId("form-item").length).toBeGreaterThanOrEqual(6);
  });
});
