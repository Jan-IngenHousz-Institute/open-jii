import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import type { UseFormReturn } from "react-hook-form";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateUserProfileBody } from "@repo/api";

import { ProfileCard } from "../profile-card";

globalThis.React = React;

const DICT: Record<string, string> = {
  // Titles & labels used by ProfileCard
  "settings.profileCard.title": "Profile Information",
  "registration.firstName": "First Name",
  "registration.lastName": "Last Name",
  "settings.profileCard.professionalTitle": "Professional Title",
  "settings.profileCard.bio": "Bio",
  "settings.profileCard.bioPlaceholder": "Tell us about yourself",
  "settings.profileCard.institution": "Institution/Organization",
  "settings.profileCard.department": "Department",
  "settings.disabled": "Disabled",

  // Common org placeholder keys (cover both possibilities)
  "settings.profileCard.organizationPlaceholder": "Search or create organization",
  "settings.profileCard.institutionPlaceholder": "Search or create organization",
};

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual("react-i18next");
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => DICT[key] ?? key,
      i18n: { language: "en", changeLanguage: () => Promise.resolve() },
    }),
    Trans: ({ i18nKey }: { i18nKey: keyof typeof DICT; children?: React.ReactNode }) =>
      DICT[i18nKey],
    initReactI18next: { type: "3rdParty", init: () => undefined },
  };
});

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
  Input: ({
    placeholder,
    trim: _trim,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { placeholder?: string; trim?: boolean }) => (
    <input data-testid="input" placeholder={placeholder} {...props} />
  ),
  Textarea: ({
    placeholder,
    rows,
    trim: _trim,
    ...props
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    placeholder?: string;
    rows?: number;
    trim?: boolean;
  }) => <textarea data-testid="textarea" placeholder={placeholder} rows={rows} {...props} />,
}));

/* ---------- TESTS ---------- */
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
    expect(screen.getByTestId("card-title")).toHaveTextContent("settings.profileCard.title");
    expect(screen.getByTestId("card-content")).toBeInTheDocument();
  });

  it("renders first name and last name fields", () => {
    render(<ProfileCard form={mockForm} />);

    // Assert labels exist
    expect(screen.getAllByTestId("form-label").map((l) => l.textContent)).toEqual(
      expect.arrayContaining(["registration.firstName", "registration.lastName"]),
    );

    const inputs = screen.getAllByTestId("input");
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it("renders bio textarea", () => {
    render(<ProfileCard form={mockForm} />);
    expect(screen.getByTestId("textarea")).toHaveAttribute(
      "placeholder",
      "settings.profileCard.bioPlaceholder",
    );
  });

  it("renders organization field", () => {
    render(<ProfileCard form={mockForm} />);
    const inputs = screen.getAllByTestId("input");
    expect(
      inputs.find(
        (i) =>
          (i as HTMLInputElement).placeholder === "settings.profileCard.institutionPlaceholder",
      ),
    ).toBeTruthy();
  });

  it("shows disabled professional title and department fields", () => {
    render(<ProfileCard form={mockForm} />);

    // Check labels exist
    expect(screen.getAllByTestId("form-label").map((l) => l.textContent)).toEqual(
      expect.arrayContaining([
        "settings.profileCard.professionalTitle",
        "settings.profileCard.department",
      ]),
    );

    // Find inputs and assert at least two are disabled (title + department)
    const inputs = screen.getAllByTestId("input");
    const disabledInputs = inputs.filter((i) => (i as HTMLInputElement).disabled);
    expect(disabledInputs.length).toBeGreaterThanOrEqual(2);

    expect(screen.getAllByText("settings.disabled").length).toBeGreaterThanOrEqual(2);
  });

  it("renders all form labels", () => {
    render(<ProfileCard form={mockForm} />);
    expect(screen.getAllByTestId("form-label").map((l) => l.textContent)).toEqual(
      expect.arrayContaining([
        "registration.firstName",
        "registration.lastName",
        "settings.profileCard.professionalTitle",
        "settings.profileCard.bio",
        "settings.profileCard.institution",
        "settings.profileCard.department",
      ]),
    );
  });

  it("renders correct number of FormItem sections", () => {
    render(<ProfileCard form={mockForm} />);
    // 2 for names, 1 for title, 1 for bio, 1 for org, 1 for dept
    expect(screen.getAllByTestId("form-item").length).toBeGreaterThanOrEqual(6);
  });
});
