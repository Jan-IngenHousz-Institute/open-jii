import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

import type { CreateExperimentBody } from "@repo/api";
import type { WizardStep } from "@repo/ui/components";

import { ReviewStep } from "./review-step";

globalThis.React = React;

/* --------------------------------- Mocks --------------------------------- */

// Mock translation
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

/* --------------------------------- Helpers --------------------------------- */

function TestWrapper({
  children,
  defaultValues,
}: {
  children: (form: UseFormReturn<CreateExperimentBody>) => React.ReactNode;
  defaultValues: Partial<CreateExperimentBody>;
}) {
  const form = useForm<CreateExperimentBody>({
    defaultValues: {
      name: "Test Experiment",
      description: "Test Description",
      visibility: "public",
      embargoUntil: undefined,
      status: "active",
      members: [],
      protocols: [],
      locations: [],
      ...defaultValues,
    },
  });

  return <>{children(form)}</>;
}

const mockStep: WizardStep<CreateExperimentBody> = {
  title: "Review",
  component: ReviewStep,
  validationSchema: z.object({}),
};

/* --------------------------------- Tests --------------------------------- */

describe("ReviewStep", () => {
  const defaultProps = {
    step: mockStep,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    goToStep: vi.fn(),
    stepIndex: 4,
    totalSteps: 5,
    isSubmitting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the review header and description", () => {
      render(
        <TestWrapper defaultValues={{}}>
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText("experiments.reviewYourExperiment")).toBeInTheDocument();
      expect(screen.getByText("experiments.reviewAllDetails")).toBeInTheDocument();
    });

    it("displays experiment name", () => {
      render(
        <TestWrapper defaultValues={{ name: "My Awesome Experiment" }}>
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText("My Awesome Experiment")).toBeInTheDocument();
    });

    it("displays description when provided", () => {
      render(
        <TestWrapper defaultValues={{ description: "This is my experiment description" }}>
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText("This is my experiment description")).toBeInTheDocument();
    });

    it("displays visibility badge", () => {
      render(
        <TestWrapper defaultValues={{ visibility: "private" }}>
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText("private")).toBeInTheDocument();
    });

    it("shows embargo date when visibility is not public", () => {
      render(
        <TestWrapper
          defaultValues={{
            visibility: "private",
            embargoUntil: "2025-12-31T23:59:59.999Z",
          }}
        >
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText("experiments.embargo")).toBeInTheDocument();
    });

    it("does not show embargo when visibility is public", () => {
      render(
        <TestWrapper defaultValues={{ visibility: "public" }}>
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.queryByText("experiments.embargo")).not.toBeInTheDocument();
    });
  });

  describe("Members", () => {
    it("displays member count correctly", () => {
      render(
        <TestWrapper
          defaultValues={{
            members: [
              { userId: "1", firstName: "John", lastName: "Doe" },
              { userId: "2", firstName: "Jane", lastName: "Smith" },
            ],
          }}
        >
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText(/experiments.teamMembers/)).toBeInTheDocument();
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });

    it("displays member names", () => {
      render(
        <TestWrapper
          defaultValues={{
            members: [{ userId: "1", firstName: "John", lastName: "Doe" }],
          }}
        >
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("shows message when no members added", () => {
      render(
        <TestWrapper defaultValues={{ members: [] }}>
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText("experiments.noMembersAdded")).toBeInTheDocument();
    });

    it("displays member initials correctly", () => {
      render(
        <TestWrapper
          defaultValues={{
            members: [{ userId: "1", firstName: "Alice", lastName: "Brown" }],
          }}
        >
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText("A")).toBeInTheDocument();
    });
  });

  describe("Protocols", () => {
    it("displays protocols count", () => {
      render(
        <TestWrapper
          defaultValues={{
            protocols: [
              { protocolId: "p1", name: "Protocol 1" },
              { protocolId: "p2", name: "Protocol 2" },
            ],
          }}
        >
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });

    it("displays protocol names", () => {
      render(
        <TestWrapper
          defaultValues={{
            protocols: [{ protocolId: "p1", name: "My Test Protocol" }],
          }}
        >
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText("My Test Protocol")).toBeInTheDocument();
    });

    it("shows message when no protocols added", () => {
      render(
        <TestWrapper defaultValues={{ protocols: [] }}>
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText("experiments.noProtocolsAdded")).toBeInTheDocument();
    });
  });

  describe("Locations", () => {
    it("displays locations count", () => {
      render(
        <TestWrapper
          defaultValues={{
            locations: [
              { name: "Location 1", longitude: 0, latitude: 0 },
              { name: "Location 2", longitude: 1, latitude: 1 },
            ],
          }}
        >
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });

    it("displays location names", () => {
      render(
        <TestWrapper
          defaultValues={{
            locations: [{ name: "Field Site A", longitude: 0, latitude: 0 }],
          }}
        >
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText("Field Site A")).toBeInTheDocument();
    });

    it("shows message when no locations added", () => {
      render(
        <TestWrapper defaultValues={{ locations: [] }}>
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByText("experiments.noLocationsAdded")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("calls goToStep with correct index when edit buttons are clicked", async () => {
      const user = userEvent.setup();
      const goToStep = vi.fn();

      render(
        <TestWrapper defaultValues={{}}>
          {(form) => <ReviewStep {...defaultProps} goToStep={goToStep} form={form} />}
        </TestWrapper>,
      );

      const editButtons = screen.getAllByText("common.edit");

      // Click first edit button (details section - step 1)
      await user.click(editButtons[0]);
      expect(goToStep).toHaveBeenCalledWith(0);

      // Click second edit button (members section - step 2)
      await user.click(editButtons[1]);
      expect(goToStep).toHaveBeenCalledWith(1);

      // Click third edit button (protocols section - step 3)
      await user.click(editButtons[2]);
      expect(goToStep).toHaveBeenCalledWith(2);

      // Click fourth edit button (locations section - step 4)
      await user.click(editButtons[3]);
      expect(goToStep).toHaveBeenCalledWith(3);
    });

    it("renders navigation buttons", () => {
      render(
        <TestWrapper defaultValues={{}}>
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      expect(screen.getByRole("button", { name: "experiments.back" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "experiments.createExperiment" }),
      ).toBeInTheDocument();
    });

    it("disables submit button when isSubmitting is true", () => {
      render(
        <TestWrapper defaultValues={{}}>
          {(form) => <ReviewStep {...defaultProps} form={form} isSubmitting={true} />}
        </TestWrapper>,
      );

      const submitButton = screen.getByRole("button", { name: "experiments.createExperiment" });
      expect(submitButton).toBeDisabled();
    });

    it("calls onPrevious when previous button is clicked", async () => {
      const user = userEvent.setup();
      const onPrevious = vi.fn();

      render(
        <TestWrapper defaultValues={{}}>
          {(form) => <ReviewStep {...defaultProps} onPrevious={onPrevious} form={form} />}
        </TestWrapper>,
      );

      await user.click(screen.getByRole("button", { name: "experiments.back" }));
      expect(onPrevious).toHaveBeenCalledTimes(1);
    });

    it("renders submit button on last step", () => {
      render(
        <TestWrapper defaultValues={{}}>
          {(form) => <ReviewStep {...defaultProps} form={form} />}
        </TestWrapper>,
      );

      const submitButton = screen.getByRole("button", { name: "experiments.createExperiment" });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveAttribute("type", "submit");
    });
  });
});
