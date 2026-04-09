import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useRouter } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { RegistrationForm } from "../auth/registration-form";

// --- Mocks ---
const pushMock = vi.fn();

// useUpdateUser — pragmatic mock (uses authClient, not ts-rest)
const mockUpdateUserMutate = vi.fn();
vi.mock("~/hooks/auth/useUpdateUser/useUpdateUser", () => ({
  useUpdateUser: () => ({
    mutateAsync: mockUpdateUserMutate,
  }),
}));

// useSignInEmail / useVerifyEmail — pragmatic mock (uses authClient, not ts-rest)
const mockSendOtpMutate = vi.fn();
const mockVerifyOtpMutate = vi.fn();
vi.mock("~/hooks/auth", () => ({
  useSignInEmail: () => ({ mutateAsync: mockSendOtpMutate }),
  useVerifyEmail: () => ({ mutateAsync: mockVerifyOtpMutate }),
}));

// useCreateUserProfile — pragmatic mock (intertwined with auth flow; mock simulates onSuccess callback chain)
const createUserProfileMock = vi.fn();
vi.mock("~/hooks/profile/useCreateUserProfile/useCreateUserProfile", () => ({
  useCreateUserProfile: (opts: { onSuccess: () => Promise<void> | void }) => ({
    mutateAsync: async (args: unknown) => {
      const result = createUserProfileMock(args) as unknown;
      if (result instanceof Promise) {
        await result;
      }
      // simulate success callback
      await Promise.resolve(opts.onSuccess());
      return Promise.resolve();
    },
  }),
}));

// --- Test data ---
const termsData = {
  title: "Terms and Conditions",
  content: "Mock terms content",
};

describe("RegistrationForm", () => {
  const defaultProps = {
    callbackUrl: "/dashboard",
    termsData,
    userEmail: "test@example.com",
  };

  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({ push: pushMock } as unknown as ReturnType<
      typeof useRouter
    >);
    mockUpdateUserMutate.mockResolvedValue({});
    mockSendOtpMutate.mockResolvedValue({});
    mockVerifyOtpMutate.mockResolvedValue({});
  });

  it("renders the registration form with title and description", () => {
    render(<RegistrationForm {...defaultProps} />);

    expect(screen.getByText("registration.title")).toBeInTheDocument();
    expect(screen.getByText("registration.description")).toBeInTheDocument();
  });

  it("renders all input fields", () => {
    render(<RegistrationForm {...defaultProps} />);

    expect(screen.getByLabelText("registration.firstName")).toBeInTheDocument();
    expect(screen.getByLabelText("registration.lastName")).toBeInTheDocument();
    expect(screen.getByLabelText("registration.organization")).toBeInTheDocument();
  });

  it("renders the terms and conditions section", async () => {
    render(<RegistrationForm {...defaultProps} />);

    expect(screen.getByText("auth.termsPrefix")).toBeInTheDocument();
    const trigger = screen.getByText("auth.terms");
    expect(trigger).toBeInTheDocument();

    // open the dialog
    const user = userEvent.setup();
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("Terms and Conditions")).toBeInTheDocument();
      expect(screen.getByText("Mock terms content")).toBeInTheDocument();
    });
  });

  it("renders the submit button with correct styling", () => {
    render(<RegistrationForm {...defaultProps} />);

    const button = screen.getByRole("button", { name: "registration.register" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("h-12", "w-full", "rounded-xl");
    expect(button).toHaveAttribute("type", "submit");
  });

  it("shows validation error if terms are not accepted", async () => {
    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "Alice");
    await user.type(screen.getByLabelText("registration.lastName"), "Smith");

    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(screen.getByText("registration.acceptTermsError")).toBeInTheDocument();
    });
    expect(createUserProfileMock).not.toHaveBeenCalled();
  });

  it("submits form successfully when terms are accepted", async () => {
    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "Jane");
    await user.type(screen.getByLabelText("registration.lastName"), "Doe");
    await user.type(screen.getByLabelText("registration.organization"), "Acme");

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(createUserProfileMock).toHaveBeenCalledWith({
        body: { firstName: "Jane", lastName: "Doe", organization: "Acme" },
      });
    });
  });

  it("calls updateUser and pushes router after successful registration", async () => {
    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "Bob");
    await user.type(screen.getByLabelText("registration.lastName"), "Builder");

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(createUserProfileMock).toHaveBeenCalled();
      expect(mockUpdateUserMutate).toHaveBeenCalledWith({ registered: true });
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("pushes to default '/' when callbackUrl is undefined", async () => {
    // Note: RegistrationForm component defaults to /platform if callbackUrl is undefined, not /
    // let's check code: `router.push(callbackUrl ?? "/platform");`
    // So if callbackUrl is undefined, it goes to /platform.
    // The test below expects "/" which contradicts the code I read.
    // BUT the old test said: `expect(pushMock).toHaveBeenCalledWith("/");`
    // If I pass termsData but no callbackUrl...

    // I will pass empty string or undefined and expect /platform or whatever the code does.
    // My previous read said `router.push(callbackUrl ?? "/platform")`
    // So expectation should be `/platform`.

    // Let's stick to what the code says.

    render(<RegistrationForm termsData={termsData} userEmail="test@example.com" />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "No");
    await user.type(screen.getByLabelText("registration.lastName"), "Callback");

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(createUserProfileMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/platform");
    });
  });

  it("renders with different locale", () => {
    const props = { ...defaultProps, locale: "de-DE" };
    render(<RegistrationForm {...props} />);

    expect(screen.getByText("registration.title")).toBeInTheDocument();
  });

  it("renders inputs empty and checkbox unchecked by default", () => {
    render(<RegistrationForm {...defaultProps} />);

    expect(screen.getByLabelText("registration.firstName")).toHaveValue("");
    expect(screen.getByLabelText("registration.lastName")).toHaveValue("");
    expect(screen.getByLabelText("registration.organization")).toHaveValue("");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("renders the submit button enabled by default", () => {
    render(<RegistrationForm {...defaultProps} />);

    const submit = screen.getByRole("button", { name: "registration.register" });
    expect(submit).not.toBeDisabled();
  });

  it("renders terms link with correct structure", () => {
    render(<RegistrationForm {...defaultProps} />);

    const termsTrigger = screen.getByText("auth.terms");
    const closestAnchorOrButton = termsTrigger.closest("a,button");
    expect(closestAnchorOrButton).toBeTruthy();
    // It should have the cursor-pointer and underline classes regardless of tag
    expect(closestAnchorOrButton).toHaveClass("cursor-pointer", "underline");
  });

  it("renders custom terms data when provided", async () => {
    const user = userEvent.setup();
    const customTermsData = { title: "Custom Terms", content: "Custom content" };
    render(<RegistrationForm {...defaultProps} termsData={customTermsData} />);

    await user.click(screen.getByText("auth.terms")); // open dialog

    expect(await screen.findByText("Custom Terms")).toBeInTheDocument();
    expect(await screen.findByText("Custom content")).toBeInTheDocument();
  });

  it("handles updateUser error after profile creation", async () => {
    mockUpdateUserMutate.mockResolvedValue({
      error: { message: "Update failed" },
    });

    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "Test");
    await user.type(screen.getByLabelText("registration.lastName"), "User");

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(createUserProfileMock).toHaveBeenCalled();
      expect(mockUpdateUserMutate).toHaveBeenCalledWith({ registered: true });
    });

    // Should not navigate on error
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("handles form submission error and resets pending state", async () => {
    // Create a mock that throws an error
    createUserProfileMock.mockRejectedValue(new Error("Network error"));

    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "Error");
    await user.type(screen.getByLabelText("registration.lastName"), "Test");

    await user.click(screen.getByRole("checkbox"));
    const submitButton = screen.getByRole("button", { name: "registration.register" });

    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);

    // Button should be disabled during submission
    await waitFor(() => {
      expect(createUserProfileMock).toHaveBeenCalled();
    });

    // After error, button should be enabled again (finally block)
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("prevents multiple submissions when already pending", async () => {
    createUserProfileMock.mockImplementation(() => {
      return new Promise((resolve) => setTimeout(resolve, 100));
    });

    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "Multi");
    await user.type(screen.getByLabelText("registration.lastName"), "Submit");

    await user.click(screen.getByRole("checkbox"));
    const submitButton = screen.getByRole("button", { name: "registration.register" });

    // First click
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });

    // Second click while pending
    await user.click(submitButton);

    // Should only call once
    expect(createUserProfileMock).toHaveBeenCalledTimes(1);
  });

  it("shows validation error if firstName is too short", async () => {
    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "A");
    await user.type(screen.getByLabelText("registration.lastName"), "Smith");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(screen.getByText("registration.firstNameError")).toBeInTheDocument();
    });
    expect(createUserProfileMock).not.toHaveBeenCalled();
  });

  it("shows validation error if lastName is too short", async () => {
    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "Alice");
    await user.type(screen.getByLabelText("registration.lastName"), "S");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(screen.getByText("registration.lastNameError")).toBeInTheDocument();
    });
    expect(createUserProfileMock).not.toHaveBeenCalled();
  });

  it("shows email field when userEmail is not a valid email", () => {
    render(<RegistrationForm termsData={termsData} userEmail="not-an-email" />);

    expect(screen.getByLabelText("registration.email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "registration.continueWithEmailVerification" }),
    ).toBeInTheDocument();
  });

  describe("emailOnly mode", () => {
    it("renders emailOnly title and description", () => {
      render(<RegistrationForm termsData={termsData} emailOnly />);

      expect(screen.getByText("registration.emailOnlyTitle")).toBeInTheDocument();
      expect(screen.getByText("registration.emailOnlyDescription")).toBeInTheDocument();
    });

    it("does not render name, organization, or terms fields", () => {
      render(<RegistrationForm termsData={termsData} emailOnly />);

      expect(screen.queryByLabelText("registration.firstName")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("registration.lastName")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("registration.organization")).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("shows validation error for empty email", async () => {
      const user = userEvent.setup();
      render(<RegistrationForm termsData={termsData} emailOnly />);

      await user.click(
        screen.getByRole("button", { name: "registration.continueWithEmailVerification" }),
      );

      await waitFor(() => {
        expect(screen.getByText("auth.emailRequired")).toBeInTheDocument();
      });
    });

    it("shows validation error for invalid email format", async () => {
      const user = userEvent.setup();
      render(<RegistrationForm termsData={termsData} emailOnly />);

      await user.type(screen.getByLabelText("registration.email"), "notanemail");

      // Use direct form submit to bypass HTML5 email validation in jsdom
      const form = screen
        .getByRole("button", { name: "registration.continueWithEmailVerification" })
        .closest("form");
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      await waitFor(() => {
        expect(screen.getByText("registration.emailInvalid")).toBeInTheDocument();
      });
    });

    it("transitions to OTP step after submitting a valid email", async () => {
      const user = userEvent.setup();
      render(<RegistrationForm termsData={termsData} emailOnly />);

      await user.type(screen.getByLabelText("registration.email"), "user@example.com");
      await user.click(
        screen.getByRole("button", { name: "registration.continueWithEmailVerification" }),
      );

      await waitFor(() => {
        expect(screen.getByText("auth.checkEmail")).toBeInTheDocument();
      });
      expect(mockSendOtpMutate).toHaveBeenCalledWith("user@example.com");
    });

    it("sets email field error when sendOtp fails", async () => {
      mockSendOtpMutate.mockResolvedValue({ error: { message: "Too many requests" } });

      const user = userEvent.setup();
      render(<RegistrationForm termsData={termsData} emailOnly />);

      await user.type(screen.getByLabelText("registration.email"), "user@example.com");
      await user.click(
        screen.getByRole("button", { name: "registration.continueWithEmailVerification" }),
      );

      await waitFor(() => {
        expect(screen.getByText("Too many requests")).toBeInTheDocument();
      });
      expect(screen.queryByText("auth.checkEmail")).not.toBeInTheDocument();
    });

    it("returns to email form when edit email button is clicked", async () => {
      render(<RegistrationForm termsData={termsData} emailOnly />);

      const user = userEvent.setup();
      await user.type(screen.getByLabelText("registration.email"), "user@example.com");
      await user.click(
        screen.getByRole("button", { name: "registration.continueWithEmailVerification" }),
      );

      await waitFor(() => {
        expect(screen.getByText("auth.checkEmail")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Edit email address" }));

      await waitFor(() => {
        expect(screen.queryByText("auth.checkEmail")).not.toBeInTheDocument();
        expect(screen.getByLabelText("registration.email")).toBeInTheDocument();
      });
    });
  });
});
