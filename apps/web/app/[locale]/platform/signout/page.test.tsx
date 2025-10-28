import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import SignOutPage from "./page";

globalThis.React = React;

// ---- Mocks ----

vi.mock("@/components/signout-dialog", () => ({
  SignOutDialog: ({ translations }: { translations: Record<string, string> }) => (
    <div data-testid="signout-dialog">
      <div data-testid="dialog-title">{translations.title}</div>
      <div data-testid="dialog-description">{translations.description}</div>
      <div data-testid="dialog-cancel">{translations.cancel}</div>
      <div data-testid="dialog-confirm">{translations.confirm}</div>
    </div>
  ),
}));

const mockT = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    "signout.title": "Sign Out",
    "signout.description": "Are you sure you want to sign out?",
    "common.cancel": "Cancel",
    "signout.confirm": "Confirm",
  };
  return translations[key] || key;
});

vi.mock("@repo/i18n", () => ({
  initTranslations: vi.fn(() =>
    Promise.resolve({
      t: mockT,
    }),
  ),
}));

describe("SignOutPage", () => {
  it("renders SignOutDialog with correct translations", async () => {
    const params = Promise.resolve({ locale: "en-US" as const });
    const searchParams = Promise.resolve({});

    const page = await SignOutPage({ params, searchParams });
    render(page);

    expect(screen.getByTestId("signout-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Sign Out");
    expect(screen.getByTestId("dialog-description")).toHaveTextContent(
      "Are you sure you want to sign out?",
    );
    expect(screen.getByTestId("dialog-cancel")).toHaveTextContent("Cancel");
    expect(screen.getByTestId("dialog-confirm")).toHaveTextContent("Confirm");
  });

  it("renders without backdrop when hideBackground is not provided", async () => {
    const params = Promise.resolve({ locale: "en-US" as const });
    const searchParams = Promise.resolve({});

    const page = await SignOutPage({ params, searchParams });
    const { container } = render(page);

    const backdrop = container.querySelector(".fixed.inset-0.z-40.bg-black");
    expect(backdrop).not.toBeInTheDocument();
  });

  it("renders without backdrop when hideBackground is false", async () => {
    const params = Promise.resolve({ locale: "en-US" as const });
    const searchParams = Promise.resolve({ hideBackground: "false" });

    const page = await SignOutPage({ params, searchParams });
    const { container } = render(page);

    const backdrop = container.querySelector(".fixed.inset-0.z-40.bg-black");
    expect(backdrop).not.toBeInTheDocument();
  });

  it("renders with backdrop when hideBackground is true", async () => {
    const params = Promise.resolve({ locale: "en-US" as const });
    const searchParams = Promise.resolve({ hideBackground: "true" });

    const page = await SignOutPage({ params, searchParams });
    const { container } = render(page);

    const backdrop = container.querySelector(".fixed.inset-0.z-40.bg-black");
    expect(backdrop).toBeInTheDocument();
  });

  it("calls initTranslations with correct locale and namespaces", async () => {
    const { initTranslations } = await import("@repo/i18n");
    const params = Promise.resolve({ locale: "de-DE" as const });
    const searchParams = Promise.resolve({});

    await SignOutPage({ params, searchParams });

    expect(initTranslations).toHaveBeenCalledWith({
      locale: "de-DE",
      namespaces: ["common"],
    });
  });

  it("passes all required translations to SignOutDialog", async () => {
    const params = Promise.resolve({ locale: "en-US" as const });
    const searchParams = Promise.resolve({});

    const page = await SignOutPage({ params, searchParams });
    render(page);

    // Verify all translation keys were called
    expect(mockT).toHaveBeenCalledWith("signout.title");
    expect(mockT).toHaveBeenCalledWith("signout.description");
    expect(mockT).toHaveBeenCalledWith("common.cancel");
    expect(mockT).toHaveBeenCalledWith("signout.confirm");
  });

  it("renders both backdrop and dialog when hideBackground is true", async () => {
    const params = Promise.resolve({ locale: "en-US" as const });
    const searchParams = Promise.resolve({ hideBackground: "true" });

    const page = await SignOutPage({ params, searchParams });
    const { container } = render(page);

    const backdrop = container.querySelector(".fixed.inset-0.z-40.bg-black");
    expect(backdrop).toBeInTheDocument();
    expect(screen.getByTestId("signout-dialog")).toBeInTheDocument();
  });
});
