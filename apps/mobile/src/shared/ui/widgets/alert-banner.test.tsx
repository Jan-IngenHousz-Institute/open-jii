import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { describe, it, expect, vi } from "vitest";

import { AlertBanner } from "./alert-banner";

vi.mock("~/shared/ui/ctf-rich-text", () => ({
  CtfRichText: ({ json }: { json: unknown }) =>
    React.createElement(Text, null, JSON.stringify(json)),
}));

const makeAlert = (overrides: Record<string, unknown> = {}) => ({
  sys: { id: "alert-1" },
  internalName: "alert-one",
  title: "Service disruption",
  severity: "info",
  type: "info",
  dismissible: true,
  active: true,
  body: null,
  link: null,
  audience: "both",
  startAt: new Date().toISOString(),
  endAt: null,
  ...overrides,
});

describe("AlertBanner", () => {
  it("renders the alert title", () => {
    render(<AlertBanner alert={makeAlert() as any} onDismiss={vi.fn()} />);
    expect(screen.getByText("Service disruption")).toBeTruthy();
  });

  it("calls onDismiss when dismiss button is pressed", () => {
    const onDismiss = vi.fn();
    render(<AlertBanner alert={makeAlert() as any} onDismiss={onDismiss} />);
    fireEvent.press(screen.getByLabelText("Dismiss alert"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("does not render dismiss button when dismissible is false", () => {
    render(<AlertBanner alert={makeAlert({ dismissible: false }) as any} onDismiss={vi.fn()} />);
    expect(screen.queryByLabelText("Dismiss alert")).toBeNull();
  });

  it("renders the CTA button when link is provided", () => {
    render(
      <AlertBanner
        alert={makeAlert({ link: { url: "https://example.com", label: "Learn more" } }) as any}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Learn more")).toBeTruthy();
  });

  it("does not render CTA when link is null", () => {
    render(<AlertBanner alert={makeAlert({ link: null }) as any} onDismiss={vi.fn()} />);
    expect(screen.queryByText("Learn more")).toBeNull();
  });

  it("renders body rich text when provided", () => {
    const json = { nodeType: "document", content: [] };
    render(<AlertBanner alert={makeAlert({ body: { json } }) as any} onDismiss={vi.fn()} />);
    expect(screen.getByText(JSON.stringify(json))).toBeTruthy();
  });
});
