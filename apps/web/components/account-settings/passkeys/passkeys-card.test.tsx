import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authClient, useSession } from "@repo/auth/client";

import { PasskeysCard } from "./passkeys-card";

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name ? `${key}:${options.name}` : key,
    i18n: { language: "en-US", changeLanguage: vi.fn() },
  }),
}));

describe("PasskeysCard", () => {
  beforeEach(() => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
  });

  it("shows the create action when WebAuthn is supported", async () => {
    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredential {});

    render(<PasskeysCard />);

    expect(await screen.findByRole("button", { name: "passkeys.add" })).toBeInTheDocument();
  });

  it("hides only the create action when WebAuthn is unavailable", async () => {
    vi.stubGlobal("PublicKeyCredential", undefined);
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
      data: [
        {
          id: "p1",
          name: "Existing passkey",
          backedUp: true,
          createdAt: "2026-07-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    render(<PasskeysCard />);

    expect(await screen.findByText("Existing passkey")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "passkeys.add" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "passkeys.renameNamed:Existing passkey" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "passkeys.deleteNamed:Existing passkey" }),
    ).toBeInTheDocument();
  });

  it("shows a loading skeleton while passkeys load", () => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockReturnValue(new Promise(() => undefined));

    render(<PasskeysCard />);

    expect(screen.getByTestId("passkeys-loading")).toBeInTheDocument();
  });

  it("shows the empty state when there are no passkeys", async () => {
    render(<PasskeysCard />);

    await waitFor(() => expect(screen.getByText("passkeys.empty")).toBeInTheDocument());
    expect(screen.queryByTestId("passkeys-loading")).not.toBeInTheDocument();
  });

  it("shows a retryable error instead of the empty state when loading fails", async () => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
      data: null,
      error: { message: "Server error" },
    });
    const user = userEvent.setup();

    render(<PasskeysCard />);

    expect(await screen.findByTestId("passkeys-error")).toBeInTheDocument();
    expect(screen.getByText("passkeys.loadError")).toBeInTheDocument();
    expect(screen.queryByText("passkeys.empty")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "passkeys.retry" }));
    await waitFor(() => expect(authClient.passkey.listUserPasskeys).toHaveBeenCalledTimes(2));
  });

  it("renders a row per passkey with the sync badge", async () => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
      data: [
        {
          id: "p1",
          name: "MacBook",
          backedUp: true,
          createdAt: "2026-07-01T00:00:00.000Z",
        },
        {
          id: "p2",
          name: null,
          backedUp: false,
          createdAt: "2026-07-02T00:00:00.000Z",
        },
      ],
      error: null,
    });

    render(<PasskeysCard />);

    await waitFor(() => expect(screen.getByText("MacBook")).toBeInTheDocument());
    expect(screen.getByText("passkeys.synced")).toBeInTheDocument();
    expect(screen.getByText("passkeys.deviceBound")).toBeInTheDocument();
    expect(screen.getByText("passkeys.unnamed")).toBeInTheDocument();
  });

  it("gives each passkey row distinct action labels", async () => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
      data: [
        {
          id: "p1",
          name: "Work laptop",
          backedUp: true,
          createdAt: "2026-07-01T00:00:00.000Z",
        },
        {
          id: "p2",
          name: "Phone",
          backedUp: true,
          createdAt: "2026-07-02T00:00:00.000Z",
        },
      ],
      error: null,
    });

    render(<PasskeysCard />);

    expect(
      await screen.findByRole("button", { name: "passkeys.renameNamed:Work laptop" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "passkeys.deleteNamed:Work laptop" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "passkeys.renameNamed:Phone" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "passkeys.deleteNamed:Phone" })).toBeInTheDocument();
  });

  it("labels a passkey from its authenticator and shows the provider as a subtitle", async () => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
      data: [
        {
          id: "p1",
          name: "My work key",
          aaguid: "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4",
          backedUp: true,
          createdAt: "2026-07-01T00:00:00.000Z",
        },
        {
          id: "p2",
          name: null,
          aaguid: "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4",
          backedUp: true,
          createdAt: "2026-07-02T00:00:00.000Z",
        },
      ],
      error: null,
    });

    render(<PasskeysCard />);

    await waitFor(() => expect(screen.getByText("My work key")).toBeInTheDocument());
    // Named row shows the provider in the meta line; unnamed row uses the provider as its name.
    expect(screen.getAllByText(/Google Password Manager/)).toHaveLength(2);
  });

  describe("the last way in", () => {
    const ONE_PASSKEY = [
      { id: "p1", name: "Work laptop", backedUp: true, createdAt: "2026-07-01T00:00:00.000Z" },
    ];

    function signedInAs(user: { email: string; emailVerified: boolean }) {
      vi.mocked(useSession).mockReturnValue({
        data: { user, session: {} },
        isPending: false,
      } as ReturnType<typeof useSession>);
    }

    beforeEach(() => {
      vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({
        data: ONE_PASSKEY,
        error: null,
      });
    });

    it("blocks deleting the only passkey of an account with no other way in", async () => {
      signedInAs({ email: "0000-0002-1825-0097", emailVerified: false });

      render(<PasskeysCard />);

      expect(await screen.findByText("passkeys.onlyWayIn")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "passkeys.deleteNamed:Work laptop" }),
      ).toBeDisabled();
    });

    it("lets the only passkey go while an account is connected", async () => {
      signedInAs({ email: "0000-0002-1825-0097", emailVerified: false });
      vi.mocked(authClient.listAccounts).mockResolvedValue({
        data: [{ id: "orcid-row", providerId: "orcid", accountId: "0000-0002-1825-0097" }],
        error: null,
      });

      render(<PasskeysCard />);

      await waitFor(() => expect(authClient.listAccounts).toHaveBeenCalled());
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "passkeys.deleteNamed:Work laptop" }),
        ).toBeEnabled(),
      );
      expect(screen.queryByText("passkeys.onlyWayIn")).not.toBeInTheDocument();
    });

    it("lets the only passkey go from an account with a confirmed address", async () => {
      signedInAs({ email: "researcher@example.com", emailVerified: true });

      render(<PasskeysCard />);

      await waitFor(() => expect(authClient.listAccounts).toHaveBeenCalled());
      expect(
        await screen.findByRole("button", { name: "passkeys.deleteNamed:Work laptop" }),
      ).toBeEnabled();
      expect(screen.queryByText("passkeys.onlyWayIn")).not.toBeInTheDocument();
    });
  });
});
