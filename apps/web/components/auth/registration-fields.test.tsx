import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useForm } from "react-hook-form";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Form } from "@repo/ui/components";

import { RegistrationFields } from "./registration-fields";
import type { Registration } from "./registration-form";

const termsData = {
  title: "Terms and Conditions",
  content: "Mock terms content",
};

function Wrapper({
  isPending = false,
  needsEmailVerification = false,
  defaultValues = {},
}: {
  isPending?: boolean;
  needsEmailVerification?: boolean;
  defaultValues?: Partial<Registration>;
}) {
  const form = useForm<Registration>({
    defaultValues: {
      firstName: "",
      lastName: "",
      organization: "",
      email: "",
      acceptedTerms: false,
      otp: "",
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form>
        <RegistrationFields
          form={form}
          isPending={isPending}
          needsEmailVerification={needsEmailVerification}
          termsData={termsData}
        />
      </form>
    </Form>
  );
}

describe("RegistrationFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.ResizeObserver = class {
      observe() {
        // Mock implementation
      }
      unobserve() {
        // Mock implementation
      }
      disconnect() {
        // Mock implementation
      }
    };
  });

  it("renders first name, last name, and organization fields", () => {
    render(<Wrapper />);

    expect(screen.getByLabelText("registration.firstName")).toBeInTheDocument();
    expect(screen.getByLabelText("registration.lastName")).toBeInTheDocument();
    expect(screen.getByLabelText("registration.organization")).toBeInTheDocument();
  });

  it("does not render email field when needsEmailVerification is false", () => {
    render(<Wrapper needsEmailVerification={false} />);

    expect(screen.queryByLabelText("registration.email")).not.toBeInTheDocument();
  });

  it("renders email field when needsEmailVerification is true", () => {
    render(<Wrapper needsEmailVerification={true} />);

    expect(screen.getByLabelText("registration.email")).toBeInTheDocument();
    expect(screen.getByText("registration.emailDescription")).toBeInTheDocument();
  });

  it("renders terms checkbox unchecked by default", () => {
    render(<Wrapper />);

    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("renders terms and conditions trigger", () => {
    render(<Wrapper />);

    const trigger = screen.getByText("auth.terms");
    expect(trigger).toBeInTheDocument();
    expect(trigger.closest("button")).toHaveClass("cursor-pointer", "underline");
  });

  it("opens terms dialog when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByText("auth.terms"));

    await waitFor(() => {
      expect(screen.getByText("Terms and Conditions")).toBeInTheDocument();
      expect(screen.getByText("Mock terms content")).toBeInTheDocument();
    });
  });

  it("disables all inputs when isPending is true", () => {
    render(<Wrapper isPending={true} />);

    expect(screen.getByLabelText("registration.firstName")).toBeDisabled();
    expect(screen.getByLabelText("registration.lastName")).toBeDisabled();
    expect(screen.getByLabelText("registration.organization")).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("reflects default values in inputs", () => {
    render(<Wrapper defaultValues={{ firstName: "Alice", lastName: "Smith" }} />);

    expect(screen.getByLabelText("registration.firstName")).toHaveValue("Alice");
    expect(screen.getByLabelText("registration.lastName")).toHaveValue("Smith");
  });
});
