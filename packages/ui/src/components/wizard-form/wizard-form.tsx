"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import type { UseFormReturn, FieldValues, UseFormProps } from "react-hook-form";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { cn } from "../../lib/utils";
import { Button } from "../button";
import type { ButtonProps } from "../button";
import { Form } from "../form";

// Types for the wizard form
export interface WizardStepProps<T extends FieldValues = FieldValues> {
  /**
   * Form instance from react-hook-form, passed down from WizardForm
   */
  form: UseFormReturn<T>;
  /**
   * Current step data
   */
  step: WizardStep<T>;
  /**
   * Move to the next step
   */
  onNext: () => void;
  /**
   * Move to the previous step
   */
  onPrevious: () => void;
  /**
   * Index of the current step
   */
  stepIndex: number;
  /**
   * Total number of steps in the wizard
   */
  totalSteps: number;
  /**
   * Is the current step submission in progress
   */
  isSubmitting?: boolean;
}

export interface WizardStepButtonProps extends ButtonProps {
  /**
   * Content of the button
   */
  children: React.ReactNode;
}

// Step component for the wizard
export function WizardStepButtons({
  onPrevious,
  onNext,
  stepIndex,
  totalSteps,
  isSubmitting = false,
  nextLabel = "Next",
  previousLabel = "Back",
  submitLabel = "Submit",
}: {
  onPrevious: () => void;
  onNext: () => void;
  stepIndex: number;
  totalSteps: number;
  isSubmitting?: boolean;
  nextLabel?: string;
  previousLabel?: string;
  submitLabel?: string;
}) {
  const isLastStep = stepIndex === totalSteps - 1;

  // Handler for the next button
  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    onNext();
  };

  // Handler for the previous button
  const handlePrevious = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    onPrevious();
  };

  return (
    <div className="mt-6 flex justify-between gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handlePrevious}
        disabled={stepIndex === 0 || isSubmitting}
      >
        {previousLabel}
      </Button>

      {isLastStep ? (
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      ) : (
        <Button type="button" onClick={handleNext} disabled={isSubmitting}>
          {nextLabel}
        </Button>
      )}
    </div>
  );
}

export interface WizardStep<T extends FieldValues = FieldValues> {
  /**
   * Title of the step to be displayed in the wizard header
   */
  title: string;
  /**
   * Description of the step (optional)
   */
  description?: string;
  /**
   * Validation schema for this step
   */
  validationSchema: z.ZodType<any>;
  /**
   * Component to render for this step
   */
  component: React.ComponentType<WizardStepProps<T>>;
  /**
   * Should this step be skipped based on form values (optional)
   */
  shouldSkip?: (data: T) => boolean;
}

export interface WizardFormProps<T extends FieldValues = FieldValues> {
  /**
   * Steps configuration for the wizard
   */
  steps: Array<WizardStep<T>>;
  /**
   * Default values for the form
   */
  defaultValues: UseFormProps<T>["defaultValues"];
  /**
   * Callback fired when the entire form is submitted (last step)
   */
  onSubmit: (data: T) => void | Promise<void>;
  /**
   * Is form submission in progress
   */
  isSubmitting?: boolean;
  /**
   * Additional classes to add to the wizard
   */
  className?: string;
  /**
   * Whether to show step indicators
   */
  showStepIndicator?: boolean;
  /**
   * Whether to show step titles
   */
  showStepTitles?: boolean;
  /**
   * Additional form props to pass to react-hook-form
   */
  formProps?: Omit<UseFormProps<T>, "defaultValues" | "resolver">;
}

export function WizardForm<T extends FieldValues>({
  steps,
  defaultValues,
  onSubmit,
  isSubmitting,
  className,
  showStepIndicator = true,
  showStepTitles = true,
  formProps = {},
}: WizardFormProps<T>) {
  // Current step index
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);

  // Create combined validation schema for the entire form
  const combinedSchema = z.object(
    steps.reduce<Record<string, z.ZodTypeAny>>((acc, step) => {
      const schemaShape = (step.validationSchema as z.ZodObject<any>).shape;
      return { ...acc, ...schemaShape };
    }, {}),
  );

  // Initialize the form
  const form = useForm<T>({
    ...formProps,
    defaultValues,
    resolver: zodResolver(combinedSchema),
    mode: "onChange",
  });

  // Calculate which steps should be skipped
  const activeSteps = React.useMemo(() => {
    return steps.filter((step) => {
      const shouldSkip = step.shouldSkip?.(form.getValues());
      return !shouldSkip;
    });
  }, [steps, form, currentStepIndex]);

  const currentStep = activeSteps[currentStepIndex];
  const StepComponent = currentStep?.component;

  // Go to the next step
  const handleNext = async () => {
    if (!currentStep) return;

    // Get fields relevant to the current step
    const currentSchemaShape = (currentStep.validationSchema as z.ZodObject<any>).shape;
    const fieldsToValidate = Object.keys(currentSchemaShape);

    // Validate only the fields for the current step
    const result = await form.trigger(fieldsToValidate as any);

    if (result) {
      if (currentStepIndex < activeSteps.length - 1) {
        // Force a re-render by using the functional state update
        setCurrentStepIndex((prevIndex) => prevIndex + 1);
      }
    }
  };

  // Go to the previous step
  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  // Handle form submission (only on the last step)
  const handleSubmit = form.handleSubmit(async (data) => {
    if (currentStepIndex === activeSteps.length - 1) {
      await onSubmit(data);
    } else {
      await handleNext();
    }
  });

  return (
    <div className={cn("w-full", className)}>
      {/* Step indicators */}
      {showStepIndicator && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            {activeSteps.map((step, index) => (
              <React.Fragment key={index}>
                {/* Step circle */}
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                    index === currentStepIndex
                      ? "bg-primary text-primary-foreground"
                      : index < currentStepIndex
                        ? "bg-primary/80 text-primary-foreground"
                        : "border-input bg-background text-muted-foreground border",
                  )}
                >
                  {index + 1}
                </div>

                {/* Connector line */}
                {index < activeSteps.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-[2px] flex-1",
                      index < currentStepIndex ? "bg-primary/80" : "bg-border",
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step titles */}
          {showStepTitles && (
            <div className="mt-2 flex items-center justify-between">
              {activeSteps.map((step, index) => (
                <div
                  key={`title-${index}`}
                  className={cn(
                    "text-center text-xs font-medium",
                    index === currentStepIndex
                      ? "text-primary"
                      : index < currentStepIndex
                        ? "text-primary/80"
                        : "text-muted-foreground",
                  )}
                  style={{ width: `${100 / activeSteps.length}%` }}
                >
                  {step.title}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Current step */}
      {currentStep && (
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-6" data-testid="form">
            {/* Step title and description for mobile */}
            {!showStepTitles && (
              <div className="mb-4">
                <h3 className="text-lg font-medium">{currentStep.title}</h3>
                {currentStep.description && (
                  <p className="text-muted-foreground mt-1 text-sm">{currentStep.description}</p>
                )}
              </div>
            )}

            {/* Render the current step component */}
            {React.createElement(currentStep.component, {
              form,
              step: currentStep,
              onNext: handleNext,
              onPrevious: handlePrevious,
              stepIndex: currentStepIndex,
              totalSteps: activeSteps.length,
              isSubmitting,
            })}
          </form>
        </Form>
      )}
    </div>
  );
}
