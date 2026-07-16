import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { authClient } from "@repo/auth/client";

import { PasskeysCard } from "./passkeys-card";

describe("PasskeysCard", () => {
  beforeEach(() => {
    vi.mocked(authClient.passkey.listUserPasskeys).mockResolvedValue({ data: [], error: null });
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
    // Named row shows the provider as a subtitle; unnamed row uses the provider as its name.
    expect(screen.getAllByText("Google Password Manager")).toHaveLength(2);
  });
});
