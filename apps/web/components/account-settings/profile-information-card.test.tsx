import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateUserProfileBody } from "@repo/api/schemas/user.schema";

import { ProfileInformationCard } from "./profile-information-card";

const profile: CreateUserProfileBody = {
  firstName: "Ada",
  lastName: "Lovelace",
  bio: "Math enjoyer",
  activated: true,
  avatarUrl: null,
};

function setup(values: Partial<CreateUserProfileBody> = {}) {
  const onSaveBio = vi.fn().mockResolvedValue(undefined);

  render(<ProfileInformationCard profile={{ ...profile, ...values }} onSaveBio={onSaveBio} />);

  return { onSaveBio };
}

describe("ProfileInformationCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders profile information", () => {
    setup();
    expect(screen.getByText("settings.ProfileInformationCard.title")).toBeInTheDocument();
    expect(screen.getByText("Math enjoyer")).toBeInTheDocument();
  });

  it("saves bio inline", async () => {
    const user = userEvent.setup();
    const { onSaveBio } = setup();

    await user.click(screen.getByText("Math enjoyer"));
    const input = screen.getByLabelText("settings.ProfileInformationCard.bio");
    await user.clear(input);
    await user.type(input, "New bio");
    await user.click(screen.getByLabelText("Save"));

    await waitFor(() => expect(onSaveBio).toHaveBeenCalledWith("New bio"));
  });

  it("renders empty states", () => {
    setup({ bio: "" });
    expect(screen.getByText("settings.ProfileInformationCard.emptyBio")).toHaveClass(
      "text-muted-foreground",
      "italic",
    );
  });
});
