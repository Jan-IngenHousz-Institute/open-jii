import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import type { CreateUserProfileBody } from "@repo/api/domains/user/user.schema";
import type { Session } from "@repo/auth/types";
import { toast } from "@repo/ui/hooks/use-toast";

import { AccountSettings } from "./account-settings";

vi.mock("./danger-zone/danger-zone-card", () => ({
  DangerZoneCard: ({ profile }: { profile: CreateUserProfileBody }) => (
    <div data-testid="danger-zone-card">{profile.avatarUrl ?? ""}</div>
  ),
}));

vi.mock("../error-display", () => ({
  ErrorDisplay: ({ title }: { title: string }) => <div data-testid="error-display">{title}</div>,
}));

vi.mock("./account-identity-card", () => ({
  AccountIdentityCard: ({
    profile,
    email,
    onSaveName,
    onSaveAvatarUrl,
  }: {
    profile: CreateUserProfileBody;
    email?: string | null;
    onSaveName: (displayName: string) => Promise<void>;
    onSaveAvatarUrl: (avatarUrl: string) => Promise<void>;
  }) => (
    <div data-testid="profile-picture-card">
      <span data-testid="avatarUrl">{profile.avatarUrl ?? ""}</span>
      <span data-testid="email">{email ?? ""}</span>
      <button type="button" onClick={() => void onSaveName("Grace Hopper")}>
        save-name
      </button>
      <button
        type="button"
        onClick={() => void onSaveAvatarUrl("https://example.com/new-avatar.png")}
      >
        save-avatar
      </button>
    </div>
  ),
}));

vi.mock("./profile-information-card", () => ({
  ProfileInformationCard: ({
    profile,
    onSaveBio,
    onSaveOrganization,
  }: {
    profile: CreateUserProfileBody;
    onSaveBio: (bio: string) => Promise<void>;
    onSaveOrganization: (organization: string) => Promise<void>;
  }) => (
    <div data-testid="profile-information-card">
      <span data-testid="firstName">{profile.firstName}</span>
      <span data-testid="lastName">{profile.lastName}</span>
      <span data-testid="bio">{profile.bio ?? ""}</span>
      <span data-testid="organization">{profile.organization ?? ""}</span>
      <button type="button" onClick={() => void onSaveBio("Updated bio")}>
        save-bio
      </button>
      <button type="button" onClick={() => void onSaveOrganization("Updated Org")}>
        save-organization
      </button>
    </div>
  ),
}));

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
  avatarUrl: "https://example.com/ada.png",
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

  it("renders profile sections with empty defaults when session is null", () => {
    render(<AccountSettings session={null} />);
    const card = screen.getByTestId("profile-information-card");
    expect(within(card).getByTestId("firstName")).toHaveTextContent("");
    expect(within(card).getByTestId("lastName")).toHaveTextContent("");
    expect(within(card).getByTestId("bio")).toHaveTextContent("");
    expect(within(card).getByTestId("organization")).toHaveTextContent("");
  });

  it("renders existing profile data", async () => {
    mountGetProfile();
    render(<AccountSettings session={session} />);

    await waitFor(() => {
      expect(
        within(screen.getByTestId("profile-information-card")).getByTestId("firstName"),
      ).toHaveTextContent("Ada");
    });

    const card = screen.getByTestId("profile-information-card");
    expect(within(card).getByTestId("lastName")).toHaveTextContent("Lovelace");
    expect(within(card).getByTestId("bio")).toHaveTextContent("Math enjoyer");
    expect(within(card).getByTestId("organization")).toHaveTextContent("Analytical Engines Inc.");

    const pictureCard = screen.getByTestId("profile-picture-card");
    expect(within(pictureCard).getByTestId("avatarUrl")).toHaveTextContent(
      "https://example.com/ada.png",
    );
    expect(within(pictureCard).getByTestId("email")).toHaveTextContent("test@example.com");
  });

  it("saves an inline name edit", async () => {
    mountGetProfile();
    const spy = mountCreateProfile();
    const user = userEvent.setup();
    render(<AccountSettings session={session} />);

    await user.click(await screen.findByRole("button", { name: "save-name" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({
      firstName: "Grace",
      lastName: "Hopper",
      bio: "Math enjoyer",
      organization: "Analytical Engines Inc.",
      avatarUrl: "https://example.com/ada.png",
    });
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ description: "settings.saved" }));
  });

  it("saves an inline avatar URL edit", async () => {
    mountGetProfile();
    const spy = mountCreateProfile();
    const user = userEvent.setup();
    render(<AccountSettings session={session} />);

    await user.click(await screen.findByRole("button", { name: "save-avatar" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      avatarUrl: "https://example.com/new-avatar.png",
    });
  });

  it("saves inline profile detail edits", async () => {
    mountGetProfile();
    const spy = mountCreateProfile();
    const user = userEvent.setup();
    render(<AccountSettings session={session} />);

    await user.click(await screen.findByRole("button", { name: "save-bio" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      bio: "Updated bio",
      organization: "Analytical Engines Inc.",
    });
  });
});
