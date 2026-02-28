import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

import type { CreateExperimentBody } from "@repo/api";
import type { WizardStep } from "@repo/ui/components";

import { ReviewStep } from "./review-step";

const mockStep: WizardStep<CreateExperimentBody> = {
  title: "Review",
  component: ReviewStep,
  validationSchema: z.object({}),
};

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

  function renderReviewStep(
    defaultValues: Partial<CreateExperimentBody> = {},
    propOverrides: Partial<typeof defaultProps> = {},
  ) {
    return renderWithForm<CreateExperimentBody>(
      (form) => <ReviewStep {...defaultProps} {...propOverrides} form={form} />,
      {
        useFormProps: {
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
        },
      },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the review header and description", () => {
      renderReviewStep();

      expect(screen.getByText("experiments.reviewYourExperiment")).toBeInTheDocument();
      expect(screen.getByText("experiments.reviewAllDetails")).toBeInTheDocument();
    });

    it("displays experiment name", () => {
      renderReviewStep({ name: "My Awesome Experiment" });

      expect(screen.getByText("My Awesome Experiment")).toBeInTheDocument();
    });

    it("displays description when provided", () => {
      renderReviewStep({ description: "This is my experiment description" });

      expect(screen.getByText("This is my experiment description")).toBeInTheDocument();
    });

    it("displays visibility badge", () => {
      renderReviewStep({ visibility: "private" });

      expect(screen.getByText("private")).toBeInTheDocument();
    });

    it("shows embargo date when visibility is not public", () => {
      renderReviewStep({
        visibility: "private",
        embargoUntil: "2025-12-31T23:59:59.999Z",
      });

      expect(screen.getByText("experiments.embargo")).toBeInTheDocument();
    });

    it("does not show embargo when visibility is public", () => {
      renderReviewStep({ visibility: "public" });

      expect(screen.queryByText("experiments.embargo")).not.toBeInTheDocument();
    });
  });

  describe("Members", () => {
    it("displays member count correctly", () => {
      renderReviewStep({
        members: [
          { userId: "1", firstName: "John", lastName: "Doe" },
          { userId: "2", firstName: "Jane", lastName: "Smith" },
        ],
      });

      expect(screen.getByText(/experiments.teamMembers/)).toBeInTheDocument();
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });

    it("displays member names", () => {
      renderReviewStep({
        members: [{ userId: "1", firstName: "John", lastName: "Doe" }],
      });

      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("shows message when no members added", () => {
      renderReviewStep({ members: [] });

      expect(screen.getByText("experiments.noMembersAdded")).toBeInTheDocument();
    });

    it("displays member initials correctly", () => {
      renderReviewStep({
        members: [{ userId: "1", firstName: "Alice", lastName: "Brown" }],
      });

      expect(screen.getByText("A")).toBeInTheDocument();
    });
  });

  describe("Locations", () => {
    it("displays locations count", () => {
      renderReviewStep({
        locations: [
          { name: "Location 1", longitude: 0, latitude: 0 },
          { name: "Location 2", longitude: 1, latitude: 1 },
        ],
      });

      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });

    it("displays location names", () => {
      renderReviewStep({
        locations: [{ name: "Field Site A", longitude: 0, latitude: 0 }],
      });

      expect(screen.getByText("Field Site A")).toBeInTheDocument();
    });

    it("shows message when no locations added", () => {
      renderReviewStep({ locations: [] });

      expect(screen.getByText("experiments.noLocationsAdded")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("calls goToStep with correct index when edit buttons are clicked", async () => {
      const user = userEvent.setup();
      const goToStep = vi.fn();

      renderReviewStep({}, { goToStep });

      const editButtons = screen.getAllByText("common.edit");

      // Click first edit button (details section - step 0)
      await user.click(editButtons[0]);
      expect(goToStep).toHaveBeenCalledWith(0);

      // Click second edit button (members section - step 1)
      await user.click(editButtons[1]);
      expect(goToStep).toHaveBeenCalledWith(1);

      // Click third edit button (locations section - step 2)
      await user.click(editButtons[2]);
      expect(goToStep).toHaveBeenCalledWith(2);
    });

    it("renders navigation buttons", () => {
      renderReviewStep();

      expect(screen.getByRole("button", { name: "experiments.back" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "experiments.createExperiment" }),
      ).toBeInTheDocument();
    });

    it("disables submit button when isSubmitting is true", () => {
      renderReviewStep({}, { isSubmitting: true });

      const submitButton = screen.getByRole("button", { name: "experiments.createExperiment" });
      expect(submitButton).toBeDisabled();
    });

    it("calls onPrevious when previous button is clicked", async () => {
      const user = userEvent.setup();
      const onPrevious = vi.fn();

      renderReviewStep({}, { onPrevious });

      await user.click(screen.getByRole("button", { name: "experiments.back" }));
      expect(onPrevious).toHaveBeenCalledTimes(1);
    });

    it("renders submit button on last step", () => {
      renderReviewStep();

      const submitButton = screen.getByRole("button", { name: "experiments.createExperiment" });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveAttribute("type", "submit");
    });
  });
});
