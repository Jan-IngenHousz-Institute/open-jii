import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

import type { Locale } from "@repo/i18n";

import { RegistrationForm } from "../auth/registration-form";

// --- Mocks ---
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const handleRegisterMock = vi.fn();
vi.mock("~/app/actions/auth", () => ({
  handleRegister: (): unknown => handleRegisterMock(),
}));

const createUserProfileMock = vi.fn();
vi.mock("~/hooks/profile/useCreateUserProfile/useCreateUserProfile", () => ({
  useCreateUserProfile: (opts: { onSuccess: () => void }) => ({
    mutate: (args: unknown) => {
      createUserProfileMock(args);
      // simulate success callback
      opts.onSuccess();
    },
  }),
}));

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key, // return translation keys directly
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
  };

  beforeAll(() => {
    // fix ResizeObserver missing in jsdom
    global.ResizeObserver = class {
      observe() {
        // no op
      }
      unobserve() {
        // no op
      }
      disconnect() {
        // no op
      }
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
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
    fireEvent.click(trigger);

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

    await userEvent.type(screen.getByLabelText("registration.firstName"), "Alice");
    await userEvent.type(screen.getByLabelText("registration.lastName"), "Smith");

    fireEvent.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(screen.getByText("registration.acceptTermsError")).toBeInTheDocument();
    });
    expect(createUserProfileMock).not.toHaveBeenCalled();
  });

  it("submits form successfully when terms are accepted", async () => {
    render(<RegistrationForm {...defaultProps} />);

    await userEvent.type(screen.getByLabelText("registration.firstName"), "Jane");
    await userEvent.type(screen.getByLabelText("registration.lastName"), "Doe");
    await userEvent.type(screen.getByLabelText("registration.organization"), "Acme");

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(createUserProfileMock).toHaveBeenCalledWith({
        body: { firstName: "Jane", lastName: "Doe", organization: "Acme" },
      });
    });
  });

  it("calls handleRegister and pushes router after success", async () => {
    render(<RegistrationForm {...defaultProps} />);

    await userEvent.type(screen.getByLabelText("registration.firstName"), "Bob");
    await userEvent.type(screen.getByLabelText("registration.lastName"), "Builder");

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(createUserProfileMock).toHaveBeenCalled();
      expect(handleRegisterMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("pushes to default '/' when callbackUrl is undefined", async () => {
    render(<RegistrationForm termsData={termsData} />);

    await userEvent.type(screen.getByLabelText("registration.firstName"), "No");
    await userEvent.type(screen.getByLabelText("registration.lastName"), "Callback");

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "registration.register" }));

    await waitFor(() => {
      expect(createUserProfileMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/");
    });
  });

  it("renders with different locale", () => {
    const props = { ...defaultProps, locale: "de-DE" as Locale };
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

    const termsLink = screen.getByText("auth.terms").closest("a");
    expect(termsLink).toHaveClass("cursor-pointer", "underline");
    expect(termsLink).toHaveAttribute("href", "#");
  });

  it("renders custom terms data when provided", async () => {
    const customTermsData = { title: "Custom Terms", content: "Custom content" };
    render(<RegistrationForm {...defaultProps} termsData={customTermsData} />);

    fireEvent.click(screen.getByText("auth.terms")); // open dialog

    expect(await screen.findByText("Custom Terms")).toBeInTheDocument();
    expect(await screen.findByText("Custom content")).toBeInTheDocument();
  });
});
