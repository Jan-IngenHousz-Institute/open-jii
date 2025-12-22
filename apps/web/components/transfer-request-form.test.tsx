/* eslint-disable @typescript-eslint/no-unsafe-return */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { TransferRequestForm } from "./transfer-request-form";

globalThis.React = React;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

// -------------------
// Mocks
// -------------------

let savedOnSuccess: (() => void) | undefined;
const mockMutate = vi.fn();
const mockUseTransferRequestCreate = vi.fn();

vi.mock("~/hooks/useTransferRequestCreate/useTransferRequestCreate", () => ({
  useTransferRequestCreate: (options?: { onSuccess?: () => void }) => {
    savedOnSuccess = options?.onSuccess;
    return mockUseTransferRequestCreate(options);
  },
}));

vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// -------------------
// Helpers
// -------------------
function renderTransferRequestForm({
  isPending = false,
  mutate = mockMutate,
}: {
  isPending?: boolean;
  mutate?: typeof mockMutate;
} = {}) {
  mockUseTransferRequestCreate.mockReturnValue({
    mutate,
    isPending,
  });

  return render(<TransferRequestForm />);
}

function triggerSuccess() {
  if (savedOnSuccess) {
    savedOnSuccess();
  }
}

// -------------------
// Tests
// -------------------
describe("<TransferRequestForm />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Form Rendering", () => {
    it("renders all form fields", () => {
      renderTransferRequestForm();

      expect(screen.getByText("transferRequest.projectIdLabel")).toBeInTheDocument();
      expect(screen.getByText("transferRequest.projectUrlLabel")).toBeInTheDocument();
      expect(screen.getByText("transferRequest.consentLabel")).toBeInTheDocument();
    });

    it("renders submit button", () => {
      renderTransferRequestForm();

      expect(screen.getByText("transferRequest.submitButton")).toBeInTheDocument();
    });

    it("renders required field indicators", () => {
      renderTransferRequestForm();

      const asterisks = screen.getAllByText("*");
      expect(asterisks).toHaveLength(3); // project ID, URL, and consent
    });

    it("renders form descriptions", () => {
      renderTransferRequestForm();

      expect(screen.getByText("transferRequest.projectIdDescription")).toBeInTheDocument();
      expect(screen.getByText("transferRequest.projectUrlDescription")).toBeInTheDocument();
    });
  });

  describe("Form Inputs", () => {
    it("renders project ID input with placeholder", () => {
      renderTransferRequestForm();

      const input = screen.getByPlaceholderText("transferRequest.projectIdPlaceholder");
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe("INPUT");
    });

    it("renders project URL input with correct type", () => {
      renderTransferRequestForm();

      const input = screen.getByPlaceholderText("transferRequest.projectUrlPlaceholder");
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("type", "url");
    });

    it("renders consent checkbox", () => {
      renderTransferRequestForm();

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });
  });

  describe("Form Validation", () => {
    it("shows validation error when submitting empty form", async () => {
      renderTransferRequestForm();

      const submitButton = screen.getByText("transferRequest.submitButton");
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errors = screen.getAllByText(/required/i);
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    it("requires consent checkbox to be checked", async () => {
      renderTransferRequestForm();
      const user = userEvent.setup();

      const projectIdInput = screen.getByPlaceholderText("transferRequest.projectIdPlaceholder");
      const projectUrlInput = screen.getByPlaceholderText("transferRequest.projectUrlPlaceholder");

      await user.type(projectIdInput, "123");
      await user.type(projectUrlInput, "https://example.com");

      const submitButton = screen.getByText("transferRequest.submitButton");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/ownership or permission/i)).toBeInTheDocument();
      });
    });

    it("accepts valid form data", async () => {
      renderTransferRequestForm();
      const user = userEvent.setup();

      const projectIdInput = screen.getByPlaceholderText("transferRequest.projectIdPlaceholder");
      const projectUrlInput = screen.getByPlaceholderText("transferRequest.projectUrlPlaceholder");
      const checkbox = screen.getByRole("checkbox");

      await user.type(projectIdInput, "project-123");
      await user.type(projectUrlInput, "https://photosynq.com/projects/123");
      await user.click(checkbox);

      const submitButton = screen.getByText("transferRequest.submitButton");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          body: {
            projectIdOld: "project-123",
            projectUrlOld: "https://photosynq.com/projects/123",
            consent: true,
          },
        });
      });
    });
  });

  describe("Form Submission", () => {
    it("calls mutate with form data on submit", async () => {
      renderTransferRequestForm();
      const user = userEvent.setup();

      const projectIdInput = screen.getByPlaceholderText("transferRequest.projectIdPlaceholder");
      const projectUrlInput = screen.getByPlaceholderText("transferRequest.projectUrlPlaceholder");
      const checkbox = screen.getByRole("checkbox");

      await user.type(projectIdInput, "test-project");
      await user.type(projectUrlInput, "https://test.com/project");
      await user.click(checkbox);

      const submitButton = screen.getByText("transferRequest.submitButton");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledTimes(1);
      });
    });

    it("disables form fields while submitting", () => {
      renderTransferRequestForm({ isPending: true });

      const projectIdInput = screen.getByPlaceholderText("transferRequest.projectIdPlaceholder");
      const projectUrlInput = screen.getByPlaceholderText("transferRequest.projectUrlPlaceholder");
      const checkbox = screen.getByRole("checkbox");
      const submitButton = screen.getByText("transferRequest.submitButton");

      expect(projectIdInput).toBeDisabled();
      expect(projectUrlInput).toBeDisabled();
      expect(checkbox).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });

    it("shows loading spinner while submitting", () => {
      renderTransferRequestForm({ isPending: true });

      const spinner = screen.getByText("transferRequest.submitButton").parentElement;
      expect(spinner?.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("Success State", () => {
    it("shows success message after submission", async () => {
      renderTransferRequestForm();
      const user = userEvent.setup();

      const projectIdInput = screen.getByPlaceholderText("transferRequest.projectIdPlaceholder");
      const projectUrlInput = screen.getByPlaceholderText("transferRequest.projectUrlPlaceholder");
      const checkbox = screen.getByRole("checkbox");

      await user.type(projectIdInput, "test-project");
      await user.type(projectUrlInput, "https://test.com");
      await user.click(checkbox);

      const submitButton = screen.getByText("transferRequest.submitButton");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled();
      });

      // Trigger success
      triggerSuccess();

      await waitFor(() => {
        expect(screen.getByText("transferRequest.successTitle")).toBeInTheDocument();
        expect(screen.getByText("transferRequest.successMessage")).toBeInTheDocument();
      });
    });

    it("shows submit another button after success", async () => {
      renderTransferRequestForm();
      const user = userEvent.setup();

      const projectIdInput = screen.getByPlaceholderText("transferRequest.projectIdPlaceholder");
      const projectUrlInput = screen.getByPlaceholderText("transferRequest.projectUrlPlaceholder");
      const checkbox = screen.getByRole("checkbox");

      await user.type(projectIdInput, "test");
      await user.type(projectUrlInput, "https://test.com");
      await user.click(checkbox);

      const submitButton = screen.getByText("transferRequest.submitButton");
      fireEvent.click(submitButton);

      await waitFor(() => expect(mockMutate).toHaveBeenCalled());

      // Trigger success
      triggerSuccess();

      await waitFor(() => {
        expect(screen.getByText("transferRequest.submitAnother")).toBeInTheDocument();
      });
    });

    it("returns to form when clicking submit another", async () => {
      renderTransferRequestForm();
      const user = userEvent.setup();

      const projectIdInput = screen.getByPlaceholderText("transferRequest.projectIdPlaceholder");
      const projectUrlInput = screen.getByPlaceholderText("transferRequest.projectUrlPlaceholder");
      const checkbox = screen.getByRole("checkbox");

      await user.type(projectIdInput, "test");
      await user.type(projectUrlInput, "https://test.com");
      await user.click(checkbox);

      const submitButton = screen.getByText("transferRequest.submitButton");
      fireEvent.click(submitButton);

      await waitFor(() => expect(mockMutate).toHaveBeenCalled());

      // Trigger success
      triggerSuccess();

      await waitFor(() => {
        expect(screen.getByText("transferRequest.submitAnother")).toBeInTheDocument();
      });

      const submitAnotherButton = screen.getByText("transferRequest.submitAnother");
      await user.click(submitAnotherButton);

      await waitFor(() => {
        expect(screen.getByText("transferRequest.submitButton")).toBeInTheDocument();
        expect(screen.queryByText("transferRequest.successTitle")).not.toBeInTheDocument();
      });
    });
  });

  describe("Form Reset", () => {
    it("resets form after successful submission", async () => {
      const { rerender } = renderTransferRequestForm();
      const user = userEvent.setup();

      const projectIdInput = screen.getByPlaceholderText("transferRequest.projectIdPlaceholder");
      const projectUrlInput = screen.getByPlaceholderText("transferRequest.projectUrlPlaceholder");
      const checkbox = screen.getByRole("checkbox");

      await user.type(projectIdInput, "test");
      await user.type(projectUrlInput, "https://test.com");
      await user.click(checkbox);

      const submitButton = screen.getByText("transferRequest.submitButton");
      fireEvent.click(submitButton);

      await waitFor(() => expect(mockMutate).toHaveBeenCalled());

      // Trigger success
      triggerSuccess();

      rerender(<TransferRequestForm />);

      const submitAnotherButton = await screen.findByText("transferRequest.submitAnother");
      await user.click(submitAnotherButton);

      await waitFor(() => {
        const newProjectIdInput = screen.getByPlaceholderText(
          "transferRequest.projectIdPlaceholder",
        );
        const newProjectUrlInput = screen.getByPlaceholderText(
          "transferRequest.projectUrlPlaceholder",
        );
        const newCheckbox = screen.getByRole("checkbox");

        expect(newProjectIdInput).toHaveValue("");
        expect(newProjectUrlInput).toHaveValue("");
        expect(newCheckbox).not.toBeChecked();
      });
    });
  });

  describe("Hook Integration", () => {
    it("calls useTransferRequestCreate with onSuccess callback", () => {
      renderTransferRequestForm();

      expect(mockUseTransferRequestCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          onSuccess: expect.any(Function) as unknown,
        }),
      );
    });
  });
});
