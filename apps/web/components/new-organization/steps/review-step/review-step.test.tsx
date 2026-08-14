import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { NewOrganizationFormValues } from "../form-step";
import { NO_TYPE, peopleSchema } from "../form-step";
import { ReviewStep } from "./review-step";

function renderReview(overrides: Partial<NewOrganizationFormValues> = {}) {
  const goToStep = vi.fn();
  const result = renderWithForm<NewOrganizationFormValues>(
    (form) => (
      <ReviewStep
        form={form}
        step={{
          title: "review",
          validationSchema: peopleSchema,
          component: ReviewStep,
        }}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        goToStep={goToStep}
        stepIndex={3}
        totalSteps={4}
      />
    ),
    {
      useFormProps: {
        defaultValues: {
          name: "Greenhouse Lab",
          slug: "greenhouse-lab",
          type: NO_TYPE,
          description: "",
          website: "",
          location: "",
          visibility: "private",
          people: [],
          ...overrides,
        },
      },
    },
  );
  return { ...result, goToStep };
}

describe("<ReviewStep />", () => {
  it("shows an unspecified type and empty optional fields as unset, not as blanks", () => {
    renderReview();

    expect(screen.getByText("organizations.types.unspecified")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("names the type that was chosen", () => {
    renderReview({ type: "university" });

    expect(screen.getByText("organizations.types.university")).toBeInTheDocument();
  });

  it("lists the people to be added, the role each gets and how they arrive", () => {
    renderReview({
      people: [
        { kind: "user", userId: "u-1", displayName: "Lin Zhao", role: "admin" },
        { kind: "email", email: "newcomer@example.org", role: "member" },
      ],
    });

    expect(screen.getByText("Lin Zhao")).toBeInTheDocument();
    // The role is the half of a person's row that cannot be inferred from their name.
    expect(screen.getByText("organizations.roles.admin")).toBeInTheDocument();
    expect(screen.getByText("newcomer@example.org")).toBeInTheDocument();
    expect(screen.getByText("organizations.create.people.emailRole")).toBeInTheDocument();
    expect(screen.getByText("organizations.create.people.count")).toBeInTheDocument();
  });

  // Both states, because a note stuck on private would look correct on the default.
  it("says what a private organization is about to be", () => {
    renderReview();

    expect(screen.getByText("organizations.create.privateNote")).toBeInTheDocument();
    expect(screen.getByText("organizations.visibility.privateLabel")).toBeInTheDocument();
  });

  it("says what a public organization is about to be", () => {
    renderReview({ visibility: "public" });

    expect(screen.getByText("organizations.create.publicNote")).toBeInTheDocument();
    expect(screen.getByText("organizations.visibility.publicLabel")).toBeInTheDocument();
    expect(screen.queryByText("organizations.create.privateNote")).not.toBeInTheDocument();
  });

  it("sends each section's edit control back to the step that owns it", async () => {
    const user = userEvent.setup();
    const { goToStep } = renderReview();

    const editButtons = screen.getAllByRole("button", { name: "common.edit" });
    expect(editButtons).toHaveLength(3);

    for (const [index, button] of editButtons.entries()) {
      await user.click(button);
      expect(goToStep).toHaveBeenLastCalledWith(index);
    }
  });
});
