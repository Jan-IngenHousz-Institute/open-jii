import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
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

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  WizardStepButtons: ({
    onPrevious,
    onNext,
    stepIndex,
    totalSteps,
    isSubmitting,
    previousLabel,
    submitLabel,
  }: {
    onPrevious?: () => void;
    onNext?: () => void;
    stepIndex: number;
    totalSteps: number;
    isSubmitting?: boolean;
    previousLabel?: string;
    submitLabel?: string;
  }) => (
    <div data-testid="wizard-buttons">
      {onPrevious && (
        <button type="button" onClick={onPrevious} data-testid="previous-button">
          {previousLabel}
        </button>
      )}
      <button type="button" onClick={onNext} disabled={isSubmitting} data-testid="next-button">
        {submitLabel}
      </button>
      <span data-testid="step-info">{`${stepIndex}/${totalSteps}`}</span>
    </div>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-title">{children}</div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
  RichTextRenderer: ({ content }: { content: string }) => (
    <div data-testid="rich-text">{content}</div>
  ),
}));

/* --------------------------------- Helpers --------------------------------- */

function createMockForm(
  values: Partial<CreateExperimentBody> = {},
): UseFormReturn<CreateExperimentBody> {
  const defaultValues: CreateExperimentBody = {
    name: "Test Experiment",
    description: "Test Description",
    visibility: "public",
    embargoUntil: undefined,
    status: "active",
    members: [],
    protocols: [],
    locations: [],
    ...values,
  };

  return {
    getValues: () => defaultValues,
    watch: vi.fn(),
    setValue: vi.fn(),
    trigger: vi.fn(),
    control: {},
    formState: { errors: {} },
  } as unknown as UseFormReturn<CreateExperimentBody>;
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
      const form = createMockForm();
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByText("experiments.reviewYourExperiment")).toBeInTheDocument();
      expect(screen.getByText("experiments.reviewAllDetails")).toBeInTheDocument();
    });

    it("displays experiment name", () => {
      const form = createMockForm({ name: "My Awesome Experiment" });
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByText("My Awesome Experiment")).toBeInTheDocument();
    });

    it("displays description when provided", () => {
      const form = createMockForm({ description: "This is my experiment description" });
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByText("This is my experiment description")).toBeInTheDocument();
    });

    it("displays visibility badge", () => {
      const form = createMockForm({ visibility: "private" });
      render(<ReviewStep {...defaultProps} form={form} />);

      const badge = screen.getByTestId("badge");
      expect(badge).toHaveTextContent("private");
    });

    it("shows embargo date when visibility is not public", () => {
      const form = createMockForm({
        visibility: "private",
        embargoUntil: "2025-12-31T23:59:59.999Z",
      });
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByText("experiments.embargo")).toBeInTheDocument();
    });

    it("does not show embargo when visibility is public", () => {
      const form = createMockForm({ visibility: "public" });
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.queryByText("experiments.embargo")).not.toBeInTheDocument();
    });
  });

  describe("Members", () => {
    it("displays member count correctly", () => {
      const form = createMockForm({
        members: [
          { userId: "1", firstName: "John", lastName: "Doe" },
          { userId: "2", firstName: "Jane", lastName: "Smith" },
        ],
      });
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByText(/experiments.teamMembers/)).toBeInTheDocument();
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });

    it("displays member names", () => {
      const form = createMockForm({
        members: [{ userId: "1", firstName: "John", lastName: "Doe" }],
      });
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("shows message when no members added", () => {
      const form = createMockForm({ members: [] });
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByText("experiments.noMembersAdded")).toBeInTheDocument();
    });

    it("displays member initials correctly", () => {
      const form = createMockForm({
        members: [{ userId: "1", firstName: "Alice", lastName: "Brown" }],
      });
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByText("A")).toBeInTheDocument();
    });
  });

  describe("Protocols", () => {
    it("displays protocols count", () => {
      const form = createMockForm({
        protocols: [
          { protocolId: "p1", name: "Protocol 1" },
          { protocolId: "p2", name: "Protocol 2" },
        ],
      });
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });

    it("displays protocol names", () => {
      const form = createMockForm({
        protocols: [{ protocolId: "p1", name: "My Test Protocol" }],
      });
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByText("My Test Protocol")).toBeInTheDocument();
    });

    it("shows message when no protocols added", () => {
      const form = createMockForm({ protocols: [] });
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByText("experiments.noProtocolsAdded")).toBeInTheDocument();
    });
  });

  describe("Locations", () => {
    it("displays locations count", () => {
      const form = createMockForm({
        locations: [
          { name: "Location 1", longitude: 0, latitude: 0 },
          { name: "Location 2", longitude: 1, latitude: 1 },
        ],
      });
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });

    it("displays location names", () => {
      const form = createMockForm({
        locations: [{ name: "Field Site A", longitude: 0, latitude: 0 }],
      });
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByText("Field Site A")).toBeInTheDocument();
    });

    it("shows message when no locations added", () => {
      const form = createMockForm({ locations: [] });
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByText("experiments.noLocationsAdded")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("calls goToStep with correct index when edit buttons are clicked", async () => {
      const user = userEvent.setup();
      const goToStep = vi.fn();
      const form = createMockForm();

      render(<ReviewStep {...defaultProps} goToStep={goToStep} form={form} />);

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

    it("passes correct props to WizardStepButtons", () => {
      const form = createMockForm();
      render(<ReviewStep {...defaultProps} form={form} />);

      expect(screen.getByTestId("wizard-buttons")).toBeInTheDocument();
      expect(screen.getByTestId("previous-button")).toBeInTheDocument();
      expect(screen.getByTestId("next-button")).toBeInTheDocument();
      expect(screen.getByTestId("step-info")).toHaveTextContent("4/5");
    });

    it("disables submit button when isSubmitting is true", () => {
      const form = createMockForm();
      render(<ReviewStep {...defaultProps} form={form} isSubmitting={true} />);

      const submitButton = screen.getByTestId("next-button");
      expect(submitButton).toBeDisabled();
    });

    it("calls onPrevious when previous button is clicked", async () => {
      const user = userEvent.setup();
      const onPrevious = vi.fn();
      const form = createMockForm();

      render(<ReviewStep {...defaultProps} onPrevious={onPrevious} form={form} />);

      await user.click(screen.getByTestId("previous-button"));
      expect(onPrevious).toHaveBeenCalledTimes(1);
    });

    it("calls onNext when next button is clicked", async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();
      const form = createMockForm();

      render(<ReviewStep {...defaultProps} onNext={onNext} form={form} />);

      await user.click(screen.getByTestId("next-button"));
      expect(onNext).toHaveBeenCalledTimes(1);
    });
  });
});
