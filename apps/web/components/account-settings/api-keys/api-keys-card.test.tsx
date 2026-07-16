import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { authClient } from "@repo/auth/client";

import { ApiKeysCard } from "./api-keys-card";

describe("ApiKeysCard", () => {
  beforeEach(() => {
    vi.mocked(authClient.apiKey.list).mockResolvedValue({
      data: { apiKeys: [], total: 0 },
      error: null,
    });
  });

  it("shows a loading skeleton while keys load", () => {
    vi.mocked(authClient.apiKey.list).mockReturnValue(new Promise(() => undefined));

    render(<ApiKeysCard />);

    expect(screen.getByTestId("api-keys-loading")).toBeInTheDocument();
  });

  it("shows the empty state when there are no keys", async () => {
    render(<ApiKeysCard />);

    await waitFor(() => expect(screen.getByText("apiKeys.empty")).toBeInTheDocument());
    expect(screen.queryByTestId("api-keys-loading")).not.toBeInTheDocument();
  });

  it("renders a row per key with masked key, expiry, and Never badge", async () => {
    vi.mocked(authClient.apiKey.list).mockResolvedValue({
      data: {
        apiKeys: [
          {
            id: "k1",
            name: "CI key",
            start: "jii_abc",
            createdAt: "2026-07-01T00:00:00.000Z",
            expiresAt: null,
            lastRequest: null,
          },
          {
            id: "k2",
            name: "Pipeline key",
            start: "jii_def",
            createdAt: "2026-07-02T00:00:00.000Z",
            expiresAt: "2026-08-01T00:00:00.000Z",
            lastRequest: "2026-07-10T00:00:00.000Z",
          },
        ],
        total: 2,
      },
      error: null,
    });

    render(<ApiKeysCard />);

    await waitFor(() => expect(screen.getByText("CI key")).toBeInTheDocument());
    expect(screen.getByText("Pipeline key")).toBeInTheDocument();
    expect(screen.getByText(/jii_abc/)).toBeInTheDocument();
    expect(screen.getByText(/jii_def/)).toBeInTheDocument();
    expect(screen.getByText("apiKeys.expirationNever")).toBeInTheDocument();
    expect(screen.getByText("apiKeys.neverUsed")).toBeInTheDocument();
  });

  it("falls back to the prefix when a key has no stored start", async () => {
    vi.mocked(authClient.apiKey.list).mockResolvedValue({
      data: {
        apiKeys: [
          {
            id: "k1",
            name: "Prefix only",
            start: null,
            prefix: "jii_pre",
            createdAt: "2026-07-01T00:00:00.000Z",
            expiresAt: null,
            lastRequest: null,
          },
        ],
        total: 1,
      },
      error: null,
    });

    render(<ApiKeysCard />);

    await waitFor(() => expect(screen.getByText("Prefix only")).toBeInTheDocument());
    expect(screen.getByText(/jii_pre/)).toBeInTheDocument();
  });
});
