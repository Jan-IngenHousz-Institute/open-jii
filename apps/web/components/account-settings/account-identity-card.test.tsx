import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateUserProfileBody } from "@repo/api/domains/user/user.schema";

import { AccountIdentityCard } from "./account-identity-card";

const profile: CreateUserProfileBody = {
  firstName: "Ada",
  lastName: "Lovelace",
  bio: "",
  organization: "Analytical Engines Inc.",
  activated: true,
  avatarUrl: "https://example.com/old.png",
};

function renderCard(values: Partial<CreateUserProfileBody> = {}) {
  const onSaveName = vi.fn().mockResolvedValue(undefined);
  const onSaveAvatarUrl = vi.fn().mockResolvedValue(undefined);

  render(
    <AccountIdentityCard
      profile={{ ...profile, ...values }}
      email="ada@example.com"
      onSaveName={onSaveName}
      onSaveAvatarUrl={onSaveAvatarUrl}
    />,
  );

  return { onSaveName, onSaveAvatarUrl };
}

describe("AccountIdentityCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders identity details", () => {
    renderCard();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("Analytical Engines Inc.")).toBeInTheDocument();
    expect(screen.getByText("settings.status.active")).toBeInTheDocument();
  });

  it("saves name edits with the shared inline title interaction", async () => {
    const user = userEvent.setup();
    const { onSaveName } = renderCard();

    await user.click(screen.getByText("Ada Lovelace"));
    const input = screen.getByDisplayValue("Ada Lovelace");
    await user.clear(input);
    await user.type(input, "Grace Hopper");
    await user.click(screen.getByLabelText("Save"));

    await waitFor(() => expect(onSaveName).toHaveBeenCalledWith("Grace Hopper"));
  });

  it("renders and saves the avatar URL inline field", async () => {
    const user = userEvent.setup();
    const { onSaveAvatarUrl } = renderCard();

    await user.click(screen.getByText("https://example.com/old.png"));
    const input = screen.getByLabelText("settings.AccountIdentityCard.urlLabel");
    await user.clear(input);
    await user.type(input, "https://example.com/new.png");
    await user.click(screen.getByLabelText("Save"));

    await waitFor(() =>
      expect(onSaveAvatarUrl).toHaveBeenCalledWith("https://example.com/new.png"),
    );
  });

  it("shows an empty avatar URL state", () => {
    renderCard({ avatarUrl: null });
    expect(screen.getByText("settings.AccountIdentityCard.emptyUrl")).toBeInTheDocument();
  });
});
