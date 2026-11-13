import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authClient, useSession } from "@repo/auth/client";

import { SignInMethodsCard } from "./sign-in-methods-card";

const EMAIL = "researcher@example.com";
const ORCID_ID = "0000-0002-1825-0097";

const GITHUB_ROW = { id: "github-row", providerId: "github", accountId: "583231" };
const ORCID_ROW = { id: "orcid-row", providerId: "orcid", accountId: ORCID_ID };

function signedInAs(user: { email: string; emailVerified: boolean } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user, session: {} } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

function withAccounts(rows: (typeof GITHUB_ROW)[]) {
  vi.mocked(authClient.listAccounts).mockResolvedValue({ data: rows, error: null });
}

function withPasskeys(count: number) {
  vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
    data: Array.from({ length: count }, (_, index) => ({
      id: `pk-${index}`,
      name: `Key ${index}`,
      backedUp: true,
      createdAt: "2026-07-01T00:00:00.000Z",
    })),
    error: null,
  });
}

/** The tile holding a provider's or a method's title. */
function tile(title: string) {
  const heading = screen.getByText(title);
  const element = heading.closest(".rounded-lg.border");
  if (!(element instanceof HTMLElement)) throw new Error(`No tile for ${title}`);
  return within(element);
}

describe("SignInMethodsCard", () => {
  beforeEach(() => {
    signedInAs({ email: EMAIL, emailVerified: true });
    withPasskeys(0);
    withAccounts([]);
  });

  afterEach(() => {
    signedInAs(null);
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({ data: [], error: null });
  });

  describe("the email tile", () => {
    it("names the address codes go to, always on, when it is a confirmed address", () => {
      render(<SignInMethodsCard />);

      expect(
        tile("signInMethods.emailTitle").getByText(`signInMethods.emailUsable:${EMAIL}`),
      ).toBeInTheDocument();
      expect(screen.getByText("signInMethods.emailBadge")).toBeInTheDocument();
    });

    it("says there is no confirmed address for the ORCID placeholder", () => {
      signedInAs({ email: ORCID_ID, emailVerified: false });

      render(<SignInMethodsCard />);

      expect(screen.getByText("signInMethods.emailUnusable")).toBeInTheDocument();
      expect(screen.queryByText("signInMethods.emailBadge")).not.toBeInTheDocument();
    });
  });

  describe("the passkeys tile", () => {
    it("shows the passkey count when the user has passkeys", async () => {
      withPasskeys(2);

      render(<SignInMethodsCard />);

      expect(await screen.findByText("signInMethods.passkeysCount:2")).toBeInTheDocument();
    });

    it("shows the empty badge when the user has no passkeys", async () => {
      render(<SignInMethodsCard />);

      expect(await screen.findByText("signInMethods.passkeysNone")).toBeInTheDocument();
    });

    it("does not report an empty state while passkeys are still loading", () => {
      vi.mocked(authClient.passkey.listUserPasskeys).mockReturnValue(new Promise(() => undefined));

      render(<SignInMethodsCard />);

      expect(screen.getByText("signInMethods.passkeysLoading")).toBeInTheDocument();
      expect(screen.queryByText("signInMethods.passkeysNone")).not.toBeInTheDocument();
    });

    it("reports passkey data as unavailable when loading fails", async () => {
      vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
        data: null,
        error: { message: "Server error" },
      });

      render(<SignInMethodsCard />);

      expect(await screen.findByText("signInMethods.passkeysUnavailable")).toBeInTheDocument();
    });
  });

  describe("the provider tiles", () => {
    it("offers to connect both providers when neither is connected", async () => {
      render(<SignInMethodsCard />);

      expect(await screen.findByText("signInMethods.notConnected")).toBeInTheDocument();
      expect(screen.getByText("signInMethods.orcidNotConnected")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "signInMethods.connect" })).toHaveLength(2);
    });

    it("starts the link for the provider whose Connect was pressed", async () => {
      render(<SignInMethodsCard />);
      await screen.findByText("signInMethods.orcidNotConnected");

      await userEvent
        .setup()
        .click(tile("ORCID").getByRole("button", { name: "signInMethods.connect" }));

      await waitFor(() =>
        expect(authClient.linkSocial).toHaveBeenCalledWith(
          expect.objectContaining({ provider: "orcid" }),
        ),
      );
      expect(tile("ORCID").getByRole("button", { name: "signInMethods.connect" })).toBeDisabled();
    });

    it("names the GitHub account it is connected as", async () => {
      withAccounts([GITHUB_ROW]);
      vi.mocked(authClient.accountInfo).mockResolvedValue({
        data: { user: {}, data: { login: "amensah" }, account: GITHUB_ROW },
        error: null,
      });

      render(<SignInMethodsCard />);

      expect(
        await screen.findByText("signInMethods.githubConnectedAs:amensah"),
      ).toBeInTheDocument();
      expect(authClient.accountInfo).toHaveBeenCalledWith({ query: { accountId: "github-row" } });
    });

    it("says only connected when the GitHub username cannot be read", async () => {
      withAccounts([GITHUB_ROW]);
      vi.mocked(authClient.accountInfo).mockResolvedValue({
        data: null,
        error: { message: "Access token not found", status: 400, statusText: "Bad Request" },
      });

      render(<SignInMethodsCard />);

      expect(await screen.findByText("signInMethods.githubConnected")).toBeInTheDocument();
      await waitFor(() => expect(authClient.accountInfo).toHaveBeenCalled());
      expect(screen.queryByText(/githubConnectedAs/)).not.toBeInTheDocument();
    });

    it("shows a connected ORCID iD as a link to the record, and never looks it up", async () => {
      withAccounts([ORCID_ROW]);

      render(<SignInMethodsCard />);

      const link = await screen.findByRole("link", { name: `https://orcid.org/${ORCID_ID}` });
      expect(link).toHaveAttribute("href", `https://orcid.org/${ORCID_ID}`);
      expect(link).toHaveAttribute("target", "_blank");
      expect(authClient.accountInfo).not.toHaveBeenCalled();
    });

    it("lets an account with a confirmed address disconnect its only provider", async () => {
      withAccounts([GITHUB_ROW]);

      render(<SignInMethodsCard />);

      await waitFor(() =>
        expect(
          tile("GitHub").getByRole("button", { name: "signInMethods.disconnect" }),
        ).toBeEnabled(),
      );
      expect(screen.queryByText(/signInMethods\.onlyWayIn/)).not.toBeInTheDocument();
    });

    it("blocks disconnecting the only way in, and says what to add first", async () => {
      signedInAs({ email: ORCID_ID, emailVerified: false });
      withAccounts([ORCID_ROW]);

      render(<SignInMethodsCard />);

      expect(await screen.findByText("signInMethods.onlyWayIn:GitHub")).toBeInTheDocument();
      expect(
        tile("ORCID").getByRole("button", { name: "signInMethods.disconnect" }),
      ).toBeDisabled();
    });

    it("keeps Disconnect disabled until the passkeys have loaded", async () => {
      signedInAs({ email: ORCID_ID, emailVerified: false });
      withAccounts([ORCID_ROW]);
      vi.mocked(authClient.passkey.listUserPasskeys).mockReturnValue(new Promise(() => undefined));

      render(<SignInMethodsCard />);

      await screen.findByRole("link", { name: `https://orcid.org/${ORCID_ID}` });
      expect(
        tile("ORCID").getByRole("button", { name: "signInMethods.disconnect" }),
      ).toBeDisabled();
      expect(screen.queryByText(/signInMethods\.onlyWayIn/)).not.toBeInTheDocument();
    });

    it("shows loading on both providers and no buttons while the accounts load", () => {
      vi.mocked(authClient.listAccounts).mockReturnValue(new Promise(() => undefined));

      render(<SignInMethodsCard />);

      expect(screen.getAllByText("signInMethods.accountsLoading")).toHaveLength(2);
      expect(screen.queryByRole("button", { name: "signInMethods.connect" })).toBeNull();
      expect(screen.queryByRole("button", { name: "signInMethods.disconnect" })).toBeNull();
    });

    it("reports the providers as unavailable when the accounts cannot be read", async () => {
      vi.mocked(authClient.listAccounts).mockResolvedValue({
        data: null,
        error: { message: "Server error", status: 500, statusText: "Internal Server Error" },
      });

      render(<SignInMethodsCard />);

      expect(await screen.findAllByText("signInMethods.accountsUnavailable")).toHaveLength(2);
      expect(screen.queryByRole("button", { name: "signInMethods.connect" })).toBeNull();
    });
  });
});
