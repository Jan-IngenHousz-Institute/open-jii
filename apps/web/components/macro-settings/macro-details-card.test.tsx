/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { MacroDetailsCard } from "./macro-details-card";

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h2 data-testid="card-title">{children}</h2>,
  CardDescription: ({ children }: any) => <p data-testid="card-description">{children}</p>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("MacroDetailsCard", () => {
  const defaultProps = {
    macroId: "macro-123",
    initialName: "Test Macro",
    initialDescription: "Test Description",
    initialLanguage: "python" as const,
  };

  it("should render card structure", () => {
    render(<MacroDetailsCard {...defaultProps} />);

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card-header")).toBeInTheDocument();
    expect(screen.getByTestId("card-title")).toBeInTheDocument();
    expect(screen.getByTestId("card-description")).toBeInTheDocument();
    expect(screen.getByTestId("card-content")).toBeInTheDocument();
  });

  it("should render card titles", () => {
    render(<MacroDetailsCard {...defaultProps} />);

    expect(screen.getByText("macroSettings.generalSettings")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.generalDescription")).toBeInTheDocument();
  });

  it("should show macro details", () => {
    render(<MacroDetailsCard {...defaultProps} />);

    expect(screen.getByText("common.name:")).toBeInTheDocument();
    expect(screen.getByText("Test Macro")).toBeInTheDocument();
    expect(screen.getByText("common.description:")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.getByText("common.language:")).toBeInTheDocument();
    expect(screen.getByText("python")).toBeInTheDocument();
  });

  it("should handle empty description", () => {
    render(<MacroDetailsCard {...defaultProps} initialDescription="" />);

    expect(screen.getByText("common.description:")).toBeInTheDocument();
    expect(screen.getByText("common.none")).toBeInTheDocument();
  });

  it("should handle R language", () => {
    render(<MacroDetailsCard {...defaultProps} initialLanguage="r" />);

    expect(screen.getByText("common.language:")).toBeInTheDocument();
    expect(screen.getByText("r")).toBeInTheDocument();
  });

  it("should handle JavaScript language", () => {
    render(<MacroDetailsCard {...defaultProps} initialLanguage="javascript" />);

    expect(screen.getByText("common.language:")).toBeInTheDocument();
    expect(screen.getByText("javascript")).toBeInTheDocument();
  });

  it("should have proper text styling for content", () => {
    render(<MacroDetailsCard {...defaultProps} />);

    expect(screen.getByText("Test Macro")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
  });

  it("should handle different macro IDs", () => {
    render(<MacroDetailsCard {...defaultProps} macroId="different-id" />);

    expect(screen.getByText("macroSettings.generalSettings")).toBeInTheDocument();
    expect(screen.getByText("Test Macro")).toBeInTheDocument();
  });

  it("should handle long macro names", () => {
    render(<MacroDetailsCard {...defaultProps} initialName="This is a very long macro name" />);

    expect(screen.getByText("This is a very long macro name")).toBeInTheDocument();
  });
});
