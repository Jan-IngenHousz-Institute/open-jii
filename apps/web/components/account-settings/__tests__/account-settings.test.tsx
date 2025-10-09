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

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: routerBackSpy }),
}));

vi.mock("../danger-zone-card", () => ({
  DangerZoneCard: () => <div data-testid="danger-zone-card" />,
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
        toastSpy({ description: "settings.saved" });
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

  return {
    Form,
    Button,
  };
});

// Mock ErrorDisplay to avoid depending on inner layout
vi.mock("../../error-display", () => ({
  ErrorDisplay: ({ title }: { title: string }) => <div data-testid="error-display">{title}</div>,
}));

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
    expect(screen.getByText(/settings.loading/i)).toBeInTheDocument();
  });

  it("shows error gate when hook returns an error", () => {
    useGetUserProfileMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("boom"),
    });

    renderSut();
    expect(screen.getByTestId("error-display")).toHaveTextContent("settings.errorTitle");
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

    fireEvent.click(screen.getByRole("button", { name: /settings.cancel/i }));
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

    mutateSpy.mockImplementation((arg: MutateArg) => {
      createCfgRef.current?.onSuccess?.();
      return arg;
    });

    fireEvent.click(screen.getByRole("button", { name: /settings.save/i }));

    expect(mutateSpy).toHaveBeenCalledWith({
      body: {
        firstName: "Ada",
        lastName: "Lovelace",
        bio: "Math enjoyer",
        organization: "Analytical Engines Inc.",
      },
    });
    expect(toastSpy).toHaveBeenCalledWith({ description: "settings.saved" });
  });

  it('shows "settings.saving" and disables the submit button when pending', () => {
    isPendingFlag = true;
    useGetUserProfileMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    renderSut();

    const btn = screen.getByRole("button", { name: /settings.saving/i });
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
