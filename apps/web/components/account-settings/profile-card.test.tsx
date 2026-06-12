import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateUserProfileBody } from "@repo/api/schemas/user.schema";

import { ProfileCard } from "./profile-card";

const profile: CreateUserProfileBody = {
  firstName: "Ada",
  lastName: "Lovelace",
  bio: "Math enjoyer",
  organization: "Analytical Engines Inc.",
  activated: true,
  avatarUrl: null,
};

function setup(values: Partial<CreateUserProfileBody> = {}) {
  const onSaveBio = vi.fn().mockResolvedValue(undefined);
  const onSaveOrganization = vi.fn().mockResolvedValue(undefined);

  render(
    <ProfileCard
      profile={{ ...profile, ...values }}
      onSaveBio={onSaveBio}
      onSaveOrganization={onSaveOrganization}
    />,
  );

  return { onSaveBio, onSaveOrganization };
}

describe("ProfileCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders profile information", () => {
    setup();
    expect(screen.getByText("settings.profileCard.title")).toBeInTheDocument();
    expect(screen.getByText("Math enjoyer")).toBeInTheDocument();
    expect(screen.getAllByText("Analytical Engines Inc.").length).toBeGreaterThanOrEqual(1);
  });

  it("saves bio inline", async () => {
    const user = userEvent.setup();
    const { onSaveBio } = setup();

    await user.click(screen.getByText("Math enjoyer"));
    const input = screen.getByLabelText("settings.profileCard.bio");
    await user.clear(input);
    await user.type(input, "New bio");
    await user.click(screen.getByLabelText("Save"));

    await waitFor(() => expect(onSaveBio).toHaveBeenCalledWith("New bio"));
  });

  it("saves organization inline", async () => {
    const user = userEvent.setup();
    const { onSaveOrganization } = setup();

    await user.click(screen.getAllByText("Analytical Engines Inc.")[0]);
    const input = screen.getByLabelText("settings.profileCard.institution");
    await user.clear(input);
    await user.type(input, "New Org");
    await user.click(screen.getByLabelText("Save"));

    await waitFor(() => expect(onSaveOrganization).toHaveBeenCalledWith("New Org"));
  });

  it("renders empty states", () => {
    setup({ bio: "", organization: "" });
    expect(screen.getByText("settings.profileCard.emptyBio")).toHaveClass(
      "text-muted-foreground",
      "italic",
    );
    expect(screen.getByText("settings.profileCard.emptyInstitution")).toHaveClass(
      "text-muted-foreground",
      "italic",
    );
  });
});
