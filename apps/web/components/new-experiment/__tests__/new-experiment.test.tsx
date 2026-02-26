import "@testing-library/jest-dom";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import type { CreateExperimentBody } from "@repo/api";
import { toast } from "@repo/ui/hooks";

import { NewExperimentForm } from "../new-experiment";

/* --------------------------------- Mocks --------------------------------- */

// WizardForm — pragmatic mock (complex multi-step wizard orchestration)
vi.mock("@repo/ui/components", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    WizardForm: ({
      onSubmit,
      isSubmitting,
    }: {
      onSubmit: (data: CreateExperimentBody) => void;
      isSubmitting?: boolean;
    }) => (
      <form
        aria-label="wizard form"
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
        <button type="submit" disabled={isSubmitting}>
          Submit
        </button>
      </form>
    ),
  };
});

/* --------------------------------- Tests --------------------------------- */

describe("NewExperimentForm", () => {
  it("renders the wizard form and unsaved changes dialog", () => {
    render(<NewExperimentForm />);
    expect(screen.getByRole("form", { name: "wizard form" })).toBeInTheDocument();
    expect(screen.getByText("experiments.unsavedChangesTitle")).toBeInTheDocument();
  });

  it("submits experiment and navigates on success", async () => {
    const spy = server.mount(contract.experiments.createExperiment, {
      body: { id: "exp-123" },
    });

    render(<NewExperimentForm />);

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(spy.callCount).toBe(1);
    });
    expect(spy.body).toEqual({
      name: "Test Experiment",
      description: "Test Description",
      visibility: "public",
      members: [],
      locations: [],
    });

  describe("Success Handling", () => {
    it("shows toast and navigates on success", () => {
      render(<NewExperimentForm />);
      const onSuccessCallback = (globalThis as GlobalWithCallback).__onSuccessCallback;
      const mockExperimentId = "exp-123";

      act(() => {
        onSuccessCallback?.(mockExperimentId);
      });

      expect(mockToast).toHaveBeenCalledWith({
        description: "experiments.experimentCreated",
      });
    });

    await waitFor(() => {
      expect(vi.mocked(useRouter)().push).toHaveBeenCalledWith(
        "/en-US/platform/experiments/exp-123",
      );
    });
  });
});
