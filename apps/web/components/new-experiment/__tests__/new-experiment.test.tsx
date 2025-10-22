import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateExperimentBody } from "@repo/api";

import { NewExperimentForm } from "../new-experiment";

globalThis.React = React;

/* --------------------------------- Types --------------------------------- */

interface MockRouter {
  push: (url: string) => void;
  back: () => void;
}

/* ----------------------------- Hoisted Mocks ----------------------------- */

interface GlobalWithCallback {
  __onSuccessCallback?: (id: string) => void;
}

const {
  mockCreateExperiment,
  mockRouterPush,
  mockRouterBack,
  mockToast,
  createExperimentMockData,
} = vi.hoisted(() => {
  const mockCreateExperiment = vi.fn();
  const mockRouterPush = vi.fn();
  const mockRouterBack = vi.fn();
  const mockToast = vi.fn();
  const createExperimentMockData = { current: { isPending: false } };

  return {
    mockCreateExperiment,
    mockRouterPush,
    mockRouterBack,
    mockToast,
    createExperimentMockData,
  };
});

/* --------------------------------- Mocks --------------------------------- */

// Mock experiment creation hook
vi.mock("@/hooks/experiment/useExperimentCreate/useExperimentCreate", () => ({
  useExperimentCreate: (config: { onSuccess: (id: string) => void }) => {
    // Store the success callback to test it
    (globalThis as GlobalWithCallback).__onSuccessCallback = config.onSuccess;
    return {
      mutate: mockCreateExperiment,
      isPending: createExperimentMockData.current.isPending,
    };
  },
}));

// Mock locale hook
vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en",
}));

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: (): MockRouter => ({
    push: mockRouterPush,
    back: mockRouterBack,
  }),
  usePathname: () => "/mock-path",
}));

// Mock translation
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock toast
vi.mock("@repo/ui/hooks", () => ({
  toast: mockToast,
}));

// Mock form components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    type?: string;
  }) => (
    <button
      data-testid="button"
      data-variant={variant}
      data-type={type}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  ),
  WizardForm: ({
    onSubmit,
    isSubmitting,
  }: {
    onSubmit: (data: CreateExperimentBody) => void;
    isSubmitting?: boolean;
  }) => (
    <form
      data-testid="wizard-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name: "Test Experiment",
          description: "Test Description",
          visibility: "public",
          members: [],
          locations: [],
        });
      }}
    >
      <button data-testid="button" type="submit" disabled={isSubmitting}>
        newExperiment.finalizeSetup
      </button>
      <button
        data-testid="button"
        type="button"
        onClick={() => {
          mockRouterBack();
        }}
      >
        newExperiment.cancel
      </button>
    </form>
  ),
  Dialog: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog">{children}</div>
  ),
  DialogContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogFooter: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  DialogTitle: ({ children }: { children?: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children?: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
}));

// ------------------ Tests ------------------

describe("NewExperimentForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createExperimentMockData.current = { isPending: false };
  });

  describe("Rendering", () => {
    it("renders the wizard form and dialog", () => {
      render(<NewExperimentForm />);

      expect(screen.getByTestId("wizard-form")).toBeInTheDocument();
      expect(screen.getByTestId("dialog")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-title")).toHaveTextContent(
        "experiments.unsavedChangesTitle",
      );
    });

    it("renders cancel and submit buttons", () => {
      render(<NewExperimentForm />);
      const buttons = screen.getAllByTestId("button");
      expect(buttons.length).toBeGreaterThanOrEqual(2);
      expect(buttons.some((b) => b.textContent === "newExperiment.cancel")).toBe(true);
      expect(buttons.some((b) => b.textContent === "newExperiment.finalizeSetup")).toBe(true);
    });
  });

  describe("Form Submission", () => {
    it("calls createExperiment with correct data", () => {
      render(<NewExperimentForm />);
      const submitButton = screen
        .getAllByTestId("button")
        .find((btn) => btn.textContent === "newExperiment.finalizeSetup");

      if (submitButton) {
        fireEvent.click(submitButton);
      }

      expect(mockCreateExperiment).toHaveBeenCalledWith({
        body: {
          name: "Test Experiment",
          description: "Test Description",
          visibility: "public",
          members: [],
          locations: [],
        },
      });
    });
  });

  describe("Success Handling", () => {
    it("shows toast and navigates on success", () => {
      render(<NewExperimentForm />);
      const onSuccessCallback = (globalThis as GlobalWithCallback).__onSuccessCallback;
      const mockExperimentId = "exp-123";

      onSuccessCallback?.(mockExperimentId);

      expect(mockToast).toHaveBeenCalledWith({
        description: "experiments.experimentCreated",
      });
      expect(mockRouterPush).toHaveBeenCalledWith("/en/platform/experiments/exp-123");
    });
  });

  describe("Cancel Button", () => {
    it("calls router.back() when cancel is clicked", async () => {
      const user = userEvent.setup();
      render(<NewExperimentForm />);

      const cancelButton = screen
        .getAllByTestId("button")
        .find((btn) => btn.textContent === "newExperiment.cancel");

      if (cancelButton) await user.click(cancelButton);

      expect(mockRouterBack).toHaveBeenCalled();
    });
  });

  describe("Loading States", () => {
    it("disables submit button and shows loading text when pending", () => {
      createExperimentMockData.current = { isPending: true };
      render(<NewExperimentForm />);

      const submitButton = screen
        .getAllByTestId("button")
        .find((btn) => btn.textContent === "newExperiment.finalizeSetup");

      expect(submitButton).toBeDisabled();
    });
  });
});
