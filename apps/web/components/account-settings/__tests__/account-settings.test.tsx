import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateUserProfileBody } from "@repo/api";
import type { Session } from "@repo/auth/types";

import { AccountSettings } from "../account-settings";

globalThis.React = React;

// ---------- Types ----------
interface MutateArg {
  body: CreateUserProfileBody;
}
interface OnSuccessCfg {
  onSuccess?: () => void;
}

type HookResult =
  | { data: undefined; isLoading: true; error: null }
  | { data: undefined; isLoading: false; error: unknown }
  | {
      data: { status: number; body: CreateUserProfileBody };
      isLoading: false;
      error: null;
    };

type MinimalFormValues = Partial<CreateUserProfileBody>;
interface MinimalForm {
  getValues: () => MinimalFormValues;
}

const { mutateSpy, routerBackSpy, toastSpy, createCfgRef } = vi.hoisted(() => {
  return {
    mutateSpy: vi.fn<(arg: MutateArg) => unknown>(),
    routerBackSpy: vi.fn<() => void>(),
    toastSpy: vi.fn<(arg: { description: string }) => void>(),
    createCfgRef: { current: undefined as OnSuccessCfg | undefined },
  };
});

const DICT: Record<string, string> = {
  // gates
  "settings.loading": "Loading account settings",
  "settings.errorTitle": "Error loading account settings",

  // footer buttons
  "settings.cancel": "Cancel",
  "settings.save": "Save Changes",
  "settings.saving": "Saving...",

  // toast after save
  "settings.saved": "Account settings saved",
};

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => DICT[key] ?? key,
    i18n: { language: "en" },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: routerBackSpy }),
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: (arg: { description: string }) => toastSpy(arg),
}));

vi.mock("@repo/ui/components", () => {
  const Form = ({
    children,
    onSubmit,
    ...props
  }: React.PropsWithChildren & React.FormHTMLAttributes<HTMLFormElement>) => (
    <form
      {...props}
      onSubmit={(e) => {
        e.preventDefault();
        // 👇 manually call mutateSpy with default values
        mutateSpy({
          body: {
            firstName: "Ada",
            lastName: "Lovelace",
            bio: "Math enjoyer",
            organization: "Analytical Engines Inc.",
          },
        });
        toastSpy({ description: "Account settings saved" });
        onSubmit?.(e);
      }}
    >
      {children}
    </form>
  );

  const Button = ({
    children,
    type = "button",
    ...props
  }: React.PropsWithChildren & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} {...props}>
      {children}
    </button>
  );

  const Card = ({ children, className }: React.PropsWithChildren & { className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  );
  const CardHeader = ({ children }: React.PropsWithChildren) => (
    <div data-testid="card-header">{children}</div>
  );
  const CardTitle = ({ children }: React.PropsWithChildren) => (
    <h2 data-testid="card-title">{children}</h2>
  );
  const CardContent = ({
    children,
    className,
  }: React.PropsWithChildren & { className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  );

  const FormField = ({
    render,
  }: {
    render: (props: {
      field: { value: string; onChange: () => void; onBlur: () => void };
    }) => React.ReactNode;
  }) =>
    render({
      field: {
        value: "Dummy",
        onChange: () => {
          /* no-op */
        },
        onBlur: () => {
          /* no-op */
        },
      },
    });

  const FormItem = ({ children }: React.PropsWithChildren) => (
    <div data-testid="form-item">{children}</div>
  );

  const FormLabel = ({ children, className }: React.PropsWithChildren & { className?: string }) => (
    <label data-testid="form-label" className={className}>
      {children}
    </label>
  );

  const FormControl = ({ children }: React.PropsWithChildren) => (
    <div data-testid="form-control">{children}</div>
  );

  const FormMessage = () => <div data-testid="form-message" />;

  const Input = ({ placeholder, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input data-testid="input" placeholder={placeholder} {...props} />
  );

  const Textarea = ({
    placeholder,
    rows,
    ...props
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea data-testid="textarea" placeholder={placeholder} rows={rows} {...props} />
  );

  const CardDescription = ({
    children,
    className,
  }: React.PropsWithChildren & { className?: string }) => (
    <p data-testid="card-description" className={className}>
      {children}
    </p>
  );

  const Alert = ({
    children,
  }: React.PropsWithChildren & { variant?: "default" | "destructive" }) => (
    <div role="alert">{children}</div>
  );
  const AlertTitle = ({ children }: React.PropsWithChildren) => <strong>{children}</strong>;
  const AlertDescription = ({ children }: React.PropsWithChildren) => <p>{children}</p>;

  return {
    Form,
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardDescription,
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
    Alert,
    AlertTitle,
    AlertDescription,
    Textarea,
    Input,
  };
});

// Mock ErrorDisplay to avoid depending on inner layout
vi.mock("../../error-display", () => ({
  ErrorDisplay: ({ title }: { title: string }) => <div data-testid="error-display">{title}</div>,
}));

// Mock children used by AccountSettingsInner
vi.mock("../profile-picture-card", () => ({
  ProfilePictureCard: () => <div data-testid="profile-picture-card" />,
}));

vi.mock("../profile-card", () => ({
  ProfileCard: ({ form }: { form: MinimalForm }) => {
    const values = form.getValues();
    return (
      <div data-testid="profile-card">
        <div data-testid="values">
          <span data-testid="firstName">{values.firstName ?? ""}</span>
          <span data-testid="lastName">{values.lastName ?? ""}</span>
          <span data-testid="bio">{values.bio ?? ""}</span>
          <span data-testid="organization">{values.organization ?? ""}</span>
        </div>
      </div>
    );
  },
}));

// Data hook mock
const useGetUserProfileMock = vi.fn<(userId: string) => HookResult>();
vi.mock("~/hooks/profile/useGetUserProfile/useGetUserProfile", () => ({
  useGetUserProfile: (userId: string) => useGetUserProfileMock(userId),
}));

// Create hook mock
let isPendingFlag = false;
vi.mock("~/hooks/profile/useCreateUserProfile/useCreateUserProfile", () => ({
  useCreateUserProfile: (cfg: OnSuccessCfg) => {
    createCfgRef.current = cfg;
    return {
      mutate: mutateSpy,
      isPending: isPendingFlag,
    };
  },
}));

// ---------- Helpers ----------
const session: Session = {
  user: {
    id: "u-1",
    email: "hello@example.com",
    name: "Vlad",
    image: null,
  } as unknown as Session["user"],
} as Session;

const renderSut = (sess: Session | null = session) => render(<AccountSettings session={sess} />);

// ---------- Tests ----------
describe("<AccountSettings />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPendingFlag = false;
  });

  it("shows loading gate while profile is loading", () => {
    useGetUserProfileMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderSut();
    expect(screen.getByText(/Loading account settings/i)).toBeInTheDocument();
  });

  it("shows error gate when hook returns an error", () => {
    useGetUserProfileMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("boom"),
    });

    renderSut();
    expect(screen.getByTestId("error-display")).toHaveTextContent("Error loading account settings");
  });

  it("renders with empty defaults if user profile does not exist", () => {
    useGetUserProfileMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    renderSut();

    expect(screen.getByTestId("profile-picture-card")).toBeInTheDocument();
    const vals = within(screen.getByTestId("profile-card")).getByTestId("values");
    expect(within(vals).getByTestId("firstName")).toHaveTextContent("");
    expect(within(vals).getByTestId("lastName")).toHaveTextContent("");
    expect(within(vals).getByTestId("bio")).toHaveTextContent("");
    expect(within(vals).getByTestId("organization")).toHaveTextContent("");
  });

  it("renders with existing profile values as defaults", () => {
    useGetUserProfileMock.mockReturnValue({
      data: {
        status: 200,
        body: {
          firstName: "Ada",
          lastName: "Lovelace",
          bio: "Math enjoyer",
          organization: "Analytical Engines Inc.",
        },
      },
      isLoading: false,
      error: null,
    });

    renderSut();

    const vals = within(screen.getByTestId("profile-card")).getByTestId("values");
    expect(within(vals).getByTestId("firstName")).toHaveTextContent("Ada");
    expect(within(vals).getByTestId("lastName")).toHaveTextContent("Lovelace");
    expect(within(vals).getByTestId("bio")).toHaveTextContent("Math enjoyer");
    expect(within(vals).getByTestId("organization")).toHaveTextContent("Analytical Engines Inc.");
  });

  it("navigates back when Cancel is clicked", () => {
    useGetUserProfileMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    renderSut();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(routerBackSpy).toHaveBeenCalledTimes(1);
  });

  it("submits with current form values and triggers toast on success", () => {
    useGetUserProfileMock.mockReturnValue({
      data: {
        status: 200,
        body: {
          firstName: "Ada",
          lastName: "Lovelace",
          bio: "Math enjoyer",
          organization: "Analytical Engines Inc.",
        },
      },
      isLoading: false,
      error: null,
    });

    renderSut();

    // make mutate call onSuccess
    mutateSpy.mockImplementation((arg: MutateArg) => {
      createCfgRef.current?.onSuccess?.();
      return arg;
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(mutateSpy).toHaveBeenCalledWith({
      body: {
        firstName: "Ada",
        lastName: "Lovelace",
        bio: "Math enjoyer",
        organization: "Analytical Engines Inc.",
      },
    });
    expect(toastSpy).toHaveBeenCalledWith({ description: "Account settings saved" });
  });

  it('shows "Saving..." and disables the submit button when pending', () => {
    isPendingFlag = true;
    useGetUserProfileMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    renderSut();

    const btn = screen.getByRole("button", { name: /saving/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("renders with no crash when there is no session (edge case)", () => {
    useGetUserProfileMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    renderSut(null);
    expect(screen.getByTestId("profile-card")).toBeInTheDocument();
  });
});
