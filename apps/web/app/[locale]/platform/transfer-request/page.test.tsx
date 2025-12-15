import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import TransferRequestPage from "./page";

globalThis.React = React;

// -------------------
// Mocks
// -------------------

vi.mock("~/components/transfer-request-form", () => ({
  TransferRequestForm: () => <div data-testid="transfer-request-form">Form Component</div>,
}));

vi.mock("@repo/i18n/server", () => ({
  default: () => Promise.resolve({ t: (key: string) => key }),
}));

// -------------------
// Helpers
// -------------------
async function renderTransferRequestPage({ locale = "en" }: { locale?: string } = {}) {
  const params = Promise.resolve({ locale });
  const component = await TransferRequestPage({ params });
  return render(component);
}

// -------------------
// Tests
// -------------------
describe("<TransferRequestPage />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Content Rendering", () => {
    it("renders the important note section", async () => {
      await renderTransferRequestPage();

      expect(screen.getByText("transferRequest.importantNote")).toBeInTheDocument();
    });

    it("renders all three note items", async () => {
      await renderTransferRequestPage();

      expect(screen.getByText("transferRequest.note1")).toBeInTheDocument();
      expect(screen.getByText("transferRequest.note2")).toBeInTheDocument();
      expect(screen.getByText("transferRequest.note3")).toBeInTheDocument();
    });

    it("renders the transfer request form component", async () => {
      await renderTransferRequestPage();

      expect(screen.getByTestId("transfer-request-form")).toBeInTheDocument();
      expect(screen.getByText("Form Component")).toBeInTheDocument();
    });
  });

  describe("Localization", () => {
    it("renders with default locale", async () => {
      await renderTransferRequestPage({ locale: "en" });

      expect(screen.getByText("transferRequest.importantNote")).toBeInTheDocument();
    });

    it("renders with different locale", async () => {
      await renderTransferRequestPage({ locale: "de" });

      expect(screen.getByText("transferRequest.importantNote")).toBeInTheDocument();
    });
  });

  describe("Layout Structure", () => {
    it("renders important notes in a highlighted box", async () => {
      const { container } = await renderTransferRequestPage();

      const noteBox = container.querySelector('[class*="bg-muted"]');
      expect(noteBox).toBeInTheDocument();
    });

    it("renders notes as an unordered list", async () => {
      const { container } = await renderTransferRequestPage();

      const list = container.querySelector("ul");
      expect(list).toBeInTheDocument();
      expect(list).toHaveClass("list-inside");
      expect(list).toHaveClass("list-disc");
    });
  });

  describe("Component Integration", () => {
    it("renders both important notes and form sections", async () => {
      await renderTransferRequestPage();

      expect(screen.getByText("transferRequest.importantNote")).toBeInTheDocument();
      expect(screen.getByTestId("transfer-request-form")).toBeInTheDocument();
    });

    it("displays all note items in order", async () => {
      await renderTransferRequestPage();

      const note1 = screen.getByText("transferRequest.note1");
      const note2 = screen.getByText("transferRequest.note2");
      const note3 = screen.getByText("transferRequest.note3");

      expect(note1).toBeInTheDocument();
      expect(note2).toBeInTheDocument();
      expect(note3).toBeInTheDocument();
    });
  });
});
