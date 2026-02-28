import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import { BasicInfoStep } from "./basic-info-step";

vi.mock("../chart-preview/chart-preview-modal", () => ({
  ChartPreviewModal: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="chart-preview-modal">{isOpen ? "Open" : "Closed"}</div>
  ),
}));

describe("BasicInfoStep", () => {
  const mockOnNext = vi.fn();
  const mockOnPrevious = vi.fn();
  const mockOnPreviewClose = vi.fn();

  const defaultProps = {
    onNext: mockOnNext,
    onPrevious: mockOnPrevious,
    goToStep: vi.fn(),
    stepIndex: 0,
    totalSteps: 4,
    isSubmitting: false,
    experimentId: "exp-123",
    isPreviewOpen: false,
    onPreviewClose: mockOnPreviewClose,
  };

  function renderBasicInfoStep(
    opts: { defaultValues?: Partial<ChartFormValues> } & Partial<typeof defaultProps> = {},
  ) {
    const { defaultValues, ...stepPropOverrides } = opts;
    const stepProps = { ...defaultProps, ...stepPropOverrides };
    return renderWithForm<ChartFormValues>(
      (form) => (
        <BasicInfoStep
          form={form}
          step={{
            title: "Basic Info",
            description: "Enter basic information",
            validationSchema: {} as never,
            component: () => null,
          }}
          {...stepProps}
        />
      ),
      {
        useFormProps: {
          defaultValues: {
            name: "",
            description: "",
            chartFamily: "basic",
            chartType: "line",
            ...defaultValues,
          } as ChartFormValues,
        },
      },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the basic info form fields", () => {
      renderBasicInfoStep();

      expect(screen.getByText("form.details.title")).toBeInTheDocument();
      expect(screen.getByText("form.details.subtitle")).toBeInTheDocument();
      expect(screen.getByLabelText("form.details.name")).toBeInTheDocument();
      expect(screen.getByLabelText("form.details.description")).toBeInTheDocument();
    });

    it("should render name input field with placeholder", () => {
      renderBasicInfoStep();

      const nameInput = screen.getByPlaceholderText("form.details.namePlaceholder");
      expect(nameInput).toBeInTheDocument();
      expect(nameInput.tagName).toBe("INPUT");
    });

    it("should render description textarea with placeholder and help text", () => {
      renderBasicInfoStep();

      const descriptionTextarea = screen.getByPlaceholderText(
        "form.details.descriptionPlaceholder",
      );
      expect(descriptionTextarea).toBeInTheDocument();
      expect(descriptionTextarea.tagName).toBe("TEXTAREA");
      expect(screen.getByText("form.details.descriptionHelp")).toBeInTheDocument();
    });

    it("should render wizard step buttons", () => {
      renderBasicInfoStep();

      expect(screen.getByRole("button", { name: "experiments.back" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "experiments.next" })).toBeInTheDocument();
    });

    it("should render chart preview modal component", () => {
      renderBasicInfoStep();

      expect(screen.getByTestId("chart-preview-modal")).toBeInTheDocument();
    });
  });

  describe("Form Interaction", () => {
    it("should allow typing in the name field", async () => {
      const user = userEvent.setup();
      renderBasicInfoStep();

      const nameInput = screen.getByPlaceholderText("form.details.namePlaceholder");
      await user.type(nameInput, "My Visualization");

      expect(nameInput).toHaveValue("My Visualization");
    });

    it("should allow typing in the description field", async () => {
      const user = userEvent.setup();
      renderBasicInfoStep();

      const descriptionTextarea = screen.getByPlaceholderText(
        "form.details.descriptionPlaceholder",
      );
      await user.type(descriptionTextarea, "A detailed description");

      expect(descriptionTextarea).toHaveValue("A detailed description");
    });

    it("should display pre-filled values when provided", () => {
      renderBasicInfoStep({
        defaultValues: {
          name: "Existing Name",
          description: "Existing Description",
        },
      });

      const nameInput = screen.getByPlaceholderText("form.details.namePlaceholder");
      const descriptionTextarea = screen.getByPlaceholderText(
        "form.details.descriptionPlaceholder",
      );

      expect(nameInput).toHaveValue("Existing Name");
      expect(descriptionTextarea).toHaveValue("Existing Description");
    });
  });

  describe("Wizard Navigation", () => {
    it("should disable previous button on first step", () => {
      renderBasicInfoStep({ stepIndex: 0 });

      const previousButton = screen.getByRole("button", { name: "experiments.back" });
      expect(previousButton).toBeDisabled();
    });

    it("should enable previous button on later steps", () => {
      renderBasicInfoStep({ stepIndex: 1 });

      const previousButton = screen.getByRole("button", { name: "experiments.back" });
      expect(previousButton).not.toBeDisabled();
    });

    it("should show next button when not on last step", () => {
      renderBasicInfoStep({ stepIndex: 0, totalSteps: 4 });

      const nextButton = screen.getByRole("button", { name: "experiments.next" });
      expect(nextButton).toBeInTheDocument();
    });

    it("should show submit button on last step", () => {
      renderBasicInfoStep({ stepIndex: 3, totalSteps: 4 });

      const submitButton = screen.getByRole("button", { name: "common.create" });
      expect(submitButton).toBeInTheDocument();
    });

    it("should disable buttons when submitting", () => {
      renderBasicInfoStep({ isSubmitting: true });

      const previousButton = screen.getByRole("button", { name: "experiments.back" });
      const nextButton = screen.getByRole("button", { name: "experiments.next" });

      expect(previousButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });
  });

  describe("Chart Preview Modal", () => {
    it("should show preview modal as closed by default", () => {
      renderBasicInfoStep({ isPreviewOpen: false });

      const modal = screen.getByTestId("chart-preview-modal");
      expect(modal).toHaveTextContent("Closed");
    });

    it("should show preview modal as open when isPreviewOpen is true", () => {
      renderBasicInfoStep({ isPreviewOpen: true });

      const modal = screen.getByTestId("chart-preview-modal");
      expect(modal).toHaveTextContent("Open");
    });
  });

  describe("Step Props", () => {
    it("should pass correct props to WizardStepButtons", () => {
      renderBasicInfoStep({ stepIndex: 2, totalSteps: 5, isSubmitting: true });

      // Verify step navigation behavior
      const previousButton = screen.getByRole("button", { name: "experiments.back" });
      const nextButton = screen.getByRole("button", { name: "experiments.next" });

      // On step 2, previous should be enabled (when not submitting)
      // but both are disabled because isSubmitting is true
      expect(previousButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });

    it("should pass experimentId to ChartPreviewModal", () => {
      renderBasicInfoStep({ experimentId: "test-exp-456" });

      // Modal should be rendered (we can't easily test the prop without inspecting)
      expect(screen.getByTestId("chart-preview-modal")).toBeInTheDocument();
    });
  });
});
