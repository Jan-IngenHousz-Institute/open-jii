import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import type { Session } from "@repo/auth/types";

import { AccountSettings } from "./account-settings";

// ── Child component mocks (each tested separately) ─────────────

vi.mock("./danger-zone-card", () => ({
  DangerZoneCard: () => <div data-testid="danger-zone-card" />,
}));

vi.mock("../error-display", () => ({
  ErrorDisplay: ({ title }: { title: string }) => <div data-testid="error-display">{title}</div>,
}));

vi.mock("./profile-picture-card", () => ({
  ProfilePictureCard: () => <div data-testid="profile-picture-card" />,
}));

vi.mock("./profile-card", () => ({
  ProfileCard: ({
    form,
  }: {
    form: {
      getValues: () => {
        firstName?: string;
        lastName?: string;
        bio?: string;
        organization?: string;
      };
    };
  }) => {
    const { firstName, lastName, bio, organization } = form.getValues();
    return (
      <div data-testid="profile-card">
        <span data-testid="firstName">{firstName ?? ""}</span>
        <span data-testid="lastName">{lastName ?? ""}</span>
        <span data-testid="bio">{bio ?? ""}</span>
        <span data-testid="organization">{organization ?? ""}</span>
      </div>
    );
  },
}));

// ── Fixtures ────────────────────────────────────────────────────

const session: Session = {
  user: {
    id: "u-1",
    email: "hello@example.com",
    name: "Vlad",
    image: null,
  } as unknown as Session["user"],
} as Session;

const profile = createUserProfile({
  userId: "u-1",
  firstName: "Ada",
  lastName: "Lovelace",
  bio: "Math enjoyer",
  organization: "Analytical Engines Inc.",
});

function mountGetProfile(options = {}) {
  return server.mount(contract.users.getUserProfile, {
    body: profile,
    status: 200,
    ...options,
  });
}

function mountCreateProfile(options = {}) {
  return server.mount(contract.users.createUserProfile, {
    body: {},
    status: 201,
    ...options,
  });
}

// ── Tests ───────────────────────────────────────────────────────

describe("<AccountSettings />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while profile is being fetched", () => {
    mountGetProfile({ delay: 999_999 });
    render(<AccountSettings session={session} />);
    expect(screen.getByText(/settings.loading/i)).toBeInTheDocument();
  });

  it("shows error display when profile fetch fails", async () => {
    server.mount(contract.users.getUserProfile, {
      status: 404,
      body: { message: "Not found" },
    });
    render(<AccountSettings session={session} />);
    await waitFor(() => {
      expect(screen.getByTestId("error-display")).toHaveTextContent("settings.errorTitle");
    });
  });

  it("renders form with empty defaults when session is null", () => {
    render(<AccountSettings session={null} />);
    const card = screen.getByTestId("profile-card");
    expect(within(card).getByTestId("firstName")).toHaveTextContent("");
    expect(within(card).getByTestId("lastName")).toHaveTextContent("");
    expect(within(card).getByTestId("bio")).toHaveTextContent("");
    expect(within(card).getByTestId("organization")).toHaveTextContent("");
  });

  it("renders form populated with existing profile data", async () => {
    mountGetProfile();
    render(<AccountSettings session={session} />);

    await waitFor(() => {
      expect(within(screen.getByTestId("profile-card")).getByTestId("firstName")).toHaveTextContent(
        "Ada",
      );
    });

    const card = screen.getByTestId("profile-card");
    expect(within(card).getByTestId("lastName")).toHaveTextContent("Lovelace");
    expect(within(card).getByTestId("bio")).toHaveTextContent("Math enjoyer");
    expect(within(card).getByTestId("organization")).toHaveTextContent("Analytical Engines Inc.");
  });

  it("navigates back when Cancel is clicked", async () => {
    const { router } = render(<AccountSettings session={null} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /settings.cancel/i }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("submits profile and shows success toast", async () => {
    mountGetProfile();
    const spy = mountCreateProfile();
    render(<AccountSettings session={session} />);

    await waitFor(() => {
      expect(screen.getByTestId("profile-card")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /settings.save/i }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      bio: "Math enjoyer",
      organization: "Analytical Engines Inc.",
    });

    const { toast } = await import("@repo/ui/hooks");
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({ description: "settings.saved" });
    });
  });

  it("shows saving state while submission is in flight", async () => {
    mountGetProfile();
    mountCreateProfile({ delay: 999_999 });
    render(<AccountSettings session={session} />);

    await waitFor(() => {
      expect(screen.getByTestId("profile-card")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /settings.save/i }));

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /settings.saving/i });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-busy", "true");
    });
  });
});
