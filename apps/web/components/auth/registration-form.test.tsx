import { createSession, createUserProfile as profileFixture } from "@/test/factories";
import { fireEvent, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { ORPCError } from "@orpc/client";
import { useRouter } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { revalidateAuth } from "~/app/actions/revalidate";

import { authClient, useSession } from "@repo/auth/client";

import { RegistrationForm } from "../auth/registration-form";

// --- Mocks ---
const pushMock = vi.fn();
const { mockSubscribeNewsletter, toastMock, getProfileMock } = vi.hoisted(() => ({
  mockSubscribeNewsletter: vi.fn(),
  toastMock: vi.fn(),
  getProfileMock: vi.fn(),
}));

vi.mock("~/lib/orpc", () => ({
  orpcClient: { users: { getUserProfile: getProfileMock } },
  orpc: {
    newsletter: {
      subscribeDirect: {
        mutationOptions: () => ({ mutationFn: mockSubscribeNewsletter }),
      },
    },
  },
}));

vi.mock("@repo/ui/hooks/use-toast", () => ({ toast: toastMock }));

const mockSendOtpMutate = vi.fn();
const mockVerifyOtpMutate = vi.fn();
vi.mock("~/hooks/auth/useSignInEmail/useSignInEmail", () => ({
  useSignInEmail: () => ({ mutateAsync: mockSendOtpMutate }),
}));
vi.mock("~/hooks/auth/useVerifyEmail/useVerifyEmail", () => ({
  useVerifyEmail: () => ({ mutateAsync: mockVerifyOtpMutate }),
}));

const createUserProfileMock = vi.fn();
vi.mock("~/hooks/profile/useCreateUserProfile/useCreateUserProfile", () => ({
  useCreateUserProfile: (opts: { onSuccess?: () => Promise<void> | void }) => ({
    mutateAsync: async (args: unknown) => {
      const result = createUserProfileMock(args) as unknown;
      if (result instanceof Promise) {
        await result;
      }
      // simulate success callback
      if (opts.onSuccess) await Promise.resolve(opts.onSuccess());
      return Promise.resolve();
    },
  }),
}));

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
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => null });
    vi.mocked(useRouter).mockReturnValue({ push: pushMock } as unknown as ReturnType<
      typeof useRouter
    >);
    vi.mocked(authClient.getSession).mockResolvedValue({ data: createSession(), error: null });
    vi.mocked(useSession).mockReturnValue({ data: createSession(), isPending: false } as ReturnType<
      typeof useSession
    >);
    getProfileMock.mockResolvedValue(profileFixture());
    mockSendOtpMutate.mockResolvedValue({});
    mockVerifyOtpMutate.mockResolvedValue({});
    createUserProfileMock.mockResolvedValue(undefined);
    mockSubscribeNewsletter.mockResolvedValue({ status: "subscribed" });
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

  it("renders a full-width submit button on the stock button shape", () => {
    render(<RegistrationForm {...defaultProps} />);

    const button = screen.getByRole("button", { name: "registration.register" });
    expect(button).toBeInTheDocument();
    // Width is the form's layout decision; height and radius are the button's
    // own and come from the primitive.
    expect(button).toHaveClass("w-full", "h-9", "rounded-md");
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

    await user.click(screen.getByRole("checkbox", { name: "registration.acceptTerms" }));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(createUserProfileMock).toHaveBeenCalledWith({
        firstName: "Jane",
        lastName: "Doe",
        avatarUrl: null,
      });
    });
  });

  it("refreshes the session and invalidates auth before navigating after profile saving", async () => {
    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "Bob");
    await user.type(screen.getByLabelText("registration.lastName"), "Builder");

    await user.click(screen.getByRole("checkbox", { name: "registration.acceptTerms" }));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(createUserProfileMock).toHaveBeenCalled();
      expect(authClient.getSession).toHaveBeenCalledWith({ query: { disableCookieCache: true } });
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
      expect(revalidateAuth).toHaveBeenCalled();
      expect(authClient.updateUser).not.toHaveBeenCalled();
      expect(vi.mocked(authClient.getSession).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(revalidateAuth).mock.invocationCallOrder[0],
      );
      expect(vi.mocked(revalidateAuth).mock.invocationCallOrder[0]).toBeLessThan(
        pushMock.mock.invocationCallOrder[0],
      );
    });
  });

  it("subscribes to the newsletter when the user opts in", async () => {
    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "News");
    await user.type(screen.getByLabelText("registration.lastName"), "Reader");
    await user.click(screen.getByRole("checkbox", { name: "registration.acceptTerms" }));
    await user.click(screen.getByRole("checkbox", { name: "registration.newsletterOptIn" }));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(mockSubscribeNewsletter).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
    expect(createUserProfileMock.mock.invocationCallOrder[0]).toBeLessThan(
      mockSubscribeNewsletter.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("does not call the newsletter endpoint when the user leaves the opt-in unchecked", async () => {
    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "No");
    await user.type(screen.getByLabelText("registration.lastName"), "Newsletter");
    await user.click(screen.getByRole("checkbox", { name: "registration.acceptTerms" }));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
    expect(mockSubscribeNewsletter).not.toHaveBeenCalled();
  });

  it("completes registration when the newsletter subscription fails", async () => {
    mockSubscribeNewsletter.mockRejectedValueOnce(new Error("Mailchimp unavailable"));
    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "Still");
    await user.type(screen.getByLabelText("registration.lastName"), "Registered");
    await user.click(screen.getByRole("checkbox", { name: "registration.acceptTerms" }));
    await user.click(screen.getByRole("checkbox", { name: "registration.newsletterOptIn" }));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
      expect(toastMock).toHaveBeenCalledWith({
        description: "registration.newsletterOptInError",
      });
    });
  });

  it("shows forgotten-email guidance when the subscription is rejected as forgotten", async () => {
    mockSubscribeNewsletter.mockRejectedValueOnce(
      new ORPCError("BAD_REQUEST", {
        status: 400,
        message: "forgotten",
        data: { code: "MAILCHIMP_FORGOTTEN_EMAIL" },
      }),
    );
    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "Forgotten");
    await user.type(screen.getByLabelText("registration.lastName"), "Reader");
    await user.click(screen.getByRole("checkbox", { name: "registration.acceptTerms" }));
    await user.click(screen.getByRole("checkbox", { name: "registration.newsletterOptIn" }));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
      expect(toastMock).toHaveBeenCalledWith({
        description: "registration.newsletterForgottenEmail",
      });
    });
  });

  it("pushes to default '/' when callbackUrl is undefined", async () => {
    // With no callbackUrl the form falls back to `router.push(callbackUrl ?? "/platform")`.

    // Let's stick to what the code says.

    render(<RegistrationForm termsData={termsData} userEmail="test@example.com" />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "No");
    await user.type(screen.getByLabelText("registration.lastName"), "Callback");

    await user.click(screen.getByRole("checkbox", { name: "registration.acceptTerms" }));
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
    expect(screen.getByRole("checkbox", { name: "registration.acceptTerms" })).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "registration.newsletterOptIn" }),
    ).not.toBeChecked();
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
    // The link treatment comes from the button primitive's `link` variant, so
    // assert that recipe rather than the classes the call site used to carry.
    expect(closestAnchorOrButton).toHaveClass("text-primary", "underline-offset-4");
  });

  it("renders custom terms data when provided", async () => {
    const user = userEvent.setup();
    const customTermsData = { title: "Custom Terms", content: "Custom content" };
    render(<RegistrationForm {...defaultProps} termsData={customTermsData} />);

    await user.click(screen.getByText("auth.terms")); // open dialog

    expect(await screen.findByText("Custom Terms")).toBeInTheDocument();
    expect(await screen.findByText("Custom content")).toBeInTheDocument();
  });

  it.each(["error", "missing", "unregistered"])(
    "does not complete when the refreshed session is %s",
    async (state) => {
      vi.mocked(authClient.getSession).mockResolvedValue(
        state === "error"
          ? { data: null, error: { message: "Refresh failed", status: 500, statusText: "Error" } }
          : {
              data: state === "missing" ? null : createSession({ user: { registered: false } }),
              error: null,
            },
      );

      render(<RegistrationForm {...defaultProps} />);

      const user = userEvent.setup();
      await user.type(screen.getByLabelText("registration.firstName"), "Test");
      await user.type(screen.getByLabelText("registration.lastName"), "User");

      await user.click(screen.getByRole("checkbox", { name: "registration.acceptTerms" }));
      await user.click(screen.getByRole("button", { name: "registration.register" }));

      await waitFor(() => {
        expect(createUserProfileMock).toHaveBeenCalled();
        expect(authClient.getSession).toHaveBeenCalledWith({ query: { disableCookieCache: true } });
      });

      expect(pushMock).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "registration.register" })).toBeEnabled();
      expect(toastMock).toHaveBeenCalledWith({ description: "registration.errorMessage" });
    },
  );

  it("handles form submission error and resets pending state", async () => {
    // Create a mock that throws an error
    createUserProfileMock.mockRejectedValue(new Error("Network error"));

    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "Error");
    await user.type(screen.getByLabelText("registration.lastName"), "Test");

    await user.click(screen.getByRole("checkbox", { name: "registration.acceptTerms" }));
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
    // A gate the test releases, not a fixed timer: a loaded runner can spend longer
    // between the two clicks than any wall-clock window, and once the mutation
    // settles the button re-enables and the second click is a real second submit.
    let releaseProfile: () => void = () => undefined;
    createUserProfileMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseProfile = () => resolve();
        }),
    );

    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "Multi");
    await user.type(screen.getByLabelText("registration.lastName"), "Submit");

    await user.click(screen.getByRole("checkbox", { name: "registration.acceptTerms" }));
    const submitButton = screen.getByRole("button", { name: "registration.register" });

    // First click
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });

    // Second click while pending
    await user.click(submitButton);

    expect(createUserProfileMock).toHaveBeenCalledTimes(1);

    // Settle the submission so the form is not left mid-flight for the next test.
    releaseProfile();
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("shows validation error if firstName is too short", async () => {
    render(<RegistrationForm {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("registration.firstName"), "A");
    await user.type(screen.getByLabelText("registration.lastName"), "Smith");
    await user.click(screen.getByRole("checkbox", { name: "registration.acceptTerms" }));
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
    await user.click(screen.getByRole("checkbox", { name: "registration.acceptTerms" }));
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
    it.each([true, false])(
      "re-saves the existing profile after email repair (registered=%s)",
      async (registered) => {
        vi.mocked(useSession).mockReturnValue({
          data: createSession({ user: { registered, email: "invalid", emailVerified: true } }),
          isPending: false,
        } as ReturnType<typeof useSession>);
        const profile = profileFixture({
          firstName: "Legacy",
          lastName: "Researcher",
          bio: "Retain this bio",
          activated: true,
          avatarUrl: "https://example.test/avatar.png",
        });
        getProfileMock.mockResolvedValue(profile);
        render(<RegistrationForm termsData={termsData} emailOnly />);
        const user = userEvent.setup();
        await user.type(screen.getByLabelText("registration.email"), "repair@example.com");
        await user.click(
          screen.getByRole("button", { name: "registration.continueWithEmailVerification" }),
        );
        const otp = screen.getByRole("textbox");
        await user.type(otp, "123456");
        await waitFor(() =>
          expect(createUserProfileMock).toHaveBeenCalledWith({
            firstName: profile.firstName,
            lastName: profile.lastName,
            bio: profile.bio,
            activated: profile.activated,
            avatarUrl: profile.avatarUrl,
          }),
        );
        await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/platform"));
        expect(authClient.updateUser).not.toHaveBeenCalled();
      },
    );

    it("does not complete email-only repair without a profile", async () => {
      getProfileMock.mockRejectedValue(new Error("Profile not found"));
      render(<RegistrationForm termsData={termsData} emailOnly />);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText("registration.email"), "repair@example.com");
      await user.click(
        screen.getByRole("button", { name: "registration.continueWithEmailVerification" }),
      );
      await user.type(screen.getByRole("textbox"), "123456");
      await waitFor(() =>
        expect(toastMock).toHaveBeenCalledWith({ description: "registration.errorMessage" }),
      );
      expect(createUserProfileMock).not.toHaveBeenCalled();
      expect(authClient.getSession).not.toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it("renders emailOnly title and description", () => {
      render(<RegistrationForm termsData={termsData} emailOnly />);

      expect(screen.getByText("registration.emailOnlyTitle")).toBeInTheDocument();
      expect(screen.getByText("registration.emailOnlyDescription")).toBeInTheDocument();
    });

    it("does not render name or terms fields", () => {
      render(<RegistrationForm termsData={termsData} emailOnly />);

      expect(screen.queryByLabelText("registration.firstName")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("registration.lastName")).not.toBeInTheDocument();
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

      // fireEvent.submit bypasses HTML5 email validation in jsdom and is auto-wrapped in act.
      const form = screen
        .getByRole("button", { name: "registration.continueWithEmailVerification" })
        .closest("form");
      if (!form) throw new Error("form not found");
      fireEvent.submit(form);

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
