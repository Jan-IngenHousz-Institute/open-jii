import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as Database from "@repo/database";

import { sendOrganizationInvitationEmail } from "../email/invitationEmail";
import { sendInvitationEmailUnlessAccountExists } from "./invitation-email";

vi.mock("../email/invitationEmail", () => ({
  sendOrganizationInvitationEmail: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Only `db` is replaced: the tables and `sql` stay real, so the lookups under test
 * are the ones that run in production — down to the `lower()` comparison — and only
 * the rows they come back with are ours to choose. Each table answers from its own
 * list, keyed on what `from()` was handed.
 */
const accounts: { id: string }[] = [];
const inviterProfiles: { firstName: string; lastName: string; activated: boolean }[] = [];
vi.mock("@repo/database", async (importOriginal) => {
  const actual = await importOriginal<typeof Database>();
  const rowsFor = (table: unknown) => (table === actual.profiles ? inviterProfiles : accounts);
  return {
    ...actual,
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({ limit: () => Promise.resolve(rowsFor(table)) }),
        }),
      }),
    },
  };
});

const INVITE = {
  email: "invitee@example.com",
  role: "admin",
  organization: { name: "Photosynthesis Lab" },
  inviter: { user: { id: "inviter-1", name: "Vlad Stoenescu", email: "vlad@example.com" } },
};

describe("who sends the organization invitation email", () => {
  beforeEach(() => {
    accounts.length = 0;
    inviterProfiles.length = 0;
    inviterProfiles.push({ firstName: "Vlad", lastName: "Stoe git", activated: true });
    vi.mocked(sendOrganizationInvitationEmail).mockClear();
    vi.stubEnv("AUTH_EMAIL_SERVER", "smtp://localhost:1025");
    vi.stubEnv("AUTH_EMAIL_FROM", "noreply@openjii.test");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://openjii.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("emails an address with no openJII account", async () => {
    await sendInvitationEmailUnlessAccountExists(INVITE);

    expect(sendOrganizationInvitationEmail).toHaveBeenCalledExactlyOnceWith({
      to: "invitee@example.com",
      // The account tab, not a per-invitation route.
      inviteUrl: "https://openjii.test/platform/account/invitations",
      organizationName: "Photosynthesis Lab",
      // The profile name, as the bell shows it — not Better Auth's `users.name`.
      inviterName: "Vlad Stoe git",
      role: "admin",
      emailServer: "smtp://localhost:1025",
      emailFrom: "noreply@openjii.test",
      senderName: "openJII",
      baseUrl: "https://openjii.test",
    });
  });

  it("stands down for an address that already has an account", async () => {
    // The backend emails this one from notification dispatch instead, so that a
    // saved "Requests and invitations" preference governs it — and so that it
    // arrives once rather than twice.
    accounts.push({ id: "user-1" });

    await sendInvitationEmailUnlessAccountExists(INVITE);

    expect(sendOrganizationInvitationEmail).not.toHaveBeenCalled();
  });

  it("names a deactivated inviter the way the backend anonymises them", async () => {
    inviterProfiles.length = 0;
    inviterProfiles.push({ firstName: "Vlad", lastName: "Stoe git", activated: false });

    await sendInvitationEmailUnlessAccountExists(INVITE);

    expect(sendOrganizationInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ inviterName: "Unknown User" }),
    );
  });

  it("falls back to the account name when the inviter has no profile yet", async () => {
    inviterProfiles.length = 0;

    await sendInvitationEmailUnlessAccountExists(INVITE);

    expect(sendOrganizationInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ inviterName: "Vlad Stoenescu" }),
    );
  });

  it("falls back to the inviter's address when they have neither", async () => {
    inviterProfiles.length = 0;

    await sendInvitationEmailUnlessAccountExists({
      ...INVITE,
      inviter: { user: { id: "inviter-1", name: "", email: "vlad@example.com" } },
    });

    expect(sendOrganizationInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ inviterName: "vlad@example.com" }),
    );
  });

  it("sends nothing when no mail server is configured", async () => {
    vi.stubEnv("AUTH_EMAIL_SERVER", "");

    await sendInvitationEmailUnlessAccountExists(INVITE);

    expect(sendOrganizationInvitationEmail).not.toHaveBeenCalled();
  });
});
