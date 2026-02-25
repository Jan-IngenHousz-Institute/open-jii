import { render, screen, waitFor, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { authClient } from "@repo/auth/client";

import { RegistrationForm } from "../auth/registration-form";

const createUserProfileMock = vi.fn();
vi.mock("~/hooks/profile/useCreateUserProfile/useCreateUserProfile", () => ({
  useCreateUserProfile: (opts: { onSuccess: () => Promise<void> | void }) => ({
    mutateAsync: async (args: unknown) => {
      const result = createUserProfileMock(args) as unknown;
      if (result instanceof Promise) {
        await result;
      }
      await Promise.resolve(opts.onSuccess());
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authClient.updateUser).mockResolvedValue({ data: {}, error: null });
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
    const user = userEvent.setup();
    render(<RegistrationForm {...defaultProps} />);

    expect(screen.getByText("auth.termsPrefix")).toBeInTheDocument();
    const trigger = screen.getByText("auth.terms");
    expect(trigger).toBeInTheDocument();

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
    const user = userEvent.setup();
    render(<RegistrationForm {...defaultProps} />);

    await user.type(screen.getByLabelText("registration.firstName"), "Alice");
    await user.type(screen.getByLabelText("registration.lastName"), "Smith");

    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(screen.getByText("registration.acceptTermsError")).toBeInTheDocument();
    });
    expect(createUserProfileMock).not.toHaveBeenCalled();
  });

  it("submits form successfully when terms are accepted", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm {...defaultProps} />);

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

  it("calls handleRegister and pushes router after success", async () => {
    const user = userEvent.setup();
    const { router } = render(<RegistrationForm {...defaultProps} />);

    await user.type(screen.getByLabelText("registration.firstName"), "Bob");
    await user.type(screen.getByLabelText("registration.lastName"), "Builder");

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(createUserProfileMock).toHaveBeenCalled();
      expect(authClient.updateUser).toHaveBeenCalledWith({ registered: true });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(router.push).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("pushes to default '/' when callbackUrl is undefined", async () => {
    const user = userEvent.setup();
    const { router } = render(<RegistrationForm termsData={termsData} />);

    await user.type(screen.getByLabelText("registration.firstName"), "No");
    await user.type(screen.getByLabelText("registration.lastName"), "Callback");

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(createUserProfileMock).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(router.push).toHaveBeenCalledWith("/platform");
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
    expect(closestAnchorOrButton).toHaveClass("cursor-pointer", "underline");
  });

  it("renders custom terms data when provided", async () => {
    const user = userEvent.setup();
    const customTermsData = { title: "Custom Terms", content: "Custom content" };
    render(<RegistrationForm {...defaultProps} termsData={customTermsData} />);

    await user.click(screen.getByText("auth.terms"));

    expect(await screen.findByText("Custom Terms")).toBeInTheDocument();
    expect(await screen.findByText("Custom content")).toBeInTheDocument();
  });

  it("handles updateUser error after profile creation", async () => {
    vi.mocked(authClient.updateUser).mockResolvedValue({
      error: { message: "Update failed" },
      data: null,
    });

    const user = userEvent.setup();
    const { router } = render(<RegistrationForm {...defaultProps} />);

    await user.type(screen.getByLabelText("registration.firstName"), "Test");
    await user.type(screen.getByLabelText("registration.lastName"), "User");

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(createUserProfileMock).toHaveBeenCalled();
      expect(authClient.updateUser).toHaveBeenCalledWith({ registered: true });
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(router.push).not.toHaveBeenCalled();
  });

  it("handles form submission error and resets pending state", async () => {
    createUserProfileMock.mockRejectedValue(new Error("Network error"));

    const user = userEvent.setup();
    render(<RegistrationForm {...defaultProps} />);

    await user.type(screen.getByLabelText("registration.firstName"), "Error");
    await user.type(screen.getByLabelText("registration.lastName"), "Test");

    await user.click(screen.getByRole("checkbox"));
    const submitButton = screen.getByRole("button", { name: "registration.register" });

    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);

    await waitFor(() => {
      expect(createUserProfileMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("prevents multiple submissions when already pending", async () => {
    createUserProfileMock.mockImplementation(() => {
      return new Promise((resolve) => setTimeout(resolve, 100));
    });

    const user = userEvent.setup();
    render(<RegistrationForm {...defaultProps} />);

    await user.type(screen.getByLabelText("registration.firstName"), "Multi");
    await user.type(screen.getByLabelText("registration.lastName"), "Submit");

    await user.click(screen.getByRole("checkbox"));
    const submitButton = screen.getByRole("button", { name: "registration.register" });

    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });

    await user.click(submitButton);

    expect(createUserProfileMock).toHaveBeenCalledTimes(1);
  });
});
