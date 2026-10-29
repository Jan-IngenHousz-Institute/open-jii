import { HydrationBoundary, QueryClient, dehydrate, useQueryClient } from "@tanstack/react-query";
import type { QueryClient as QueryClientType } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { useSession as UseSession } from "@repo/auth/client";

import { server } from "../../test/msw/server";

// The real better-auth client, which binds `fetch` when it loads, so it loads after msw listens.
vi.unmock("@repo/auth/client");
const { reloadPage } = vi.hoisted(() => ({ reloadPage: vi.fn() }));
vi.mock("@/lib/reload-page", () => ({ reloadPage }));

let useSession: typeof UseSession;
let QueryProvider: (props: { children: ReactNode }) => ReactNode;
let PrincipalGate: (props: { userId: string; children: ReactNode }) => ReactNode;

beforeAll(async () => {
  ({ useSession } = await import("@repo/auth/client"));
  ({ QueryProvider } = await import("~/providers/QueryProvider"));
  ({ PrincipalGate } = await import("./principal-gate"));
});

const people = {
  researcher: { id: "researcher-a", isAnonymous: false },
  guest: { id: "guest-a", isAnonymous: true },
};
type Who = keyof typeof people | "signed-out";
const sessionOf = (who: Who) =>
  who === "signed-out"
    ? null
    : {
        user: { ...people[who], email: `${people[who].id}@example.org`, name: who },
        session: { id: `s-${who}`, userId: people[who].id, expiresAt: "2099-01-01T00:00:00Z" },
      };
const idOf = (who: Who) => (who === "signed-out" ? "signed-out" : people[who].id);

let current: Who = "researcher";
let gets = 0;
// Answers served before falling back to `current`, one per get-session request.
let queue: (() => Response | Promise<Response>)[] = [];
beforeEach(() => {
  gets = 0;
  queue = [];
  reloadPage.mockClear();
  window.sessionStorage.clear();
  server.use(
    http.get("*/api/v1/auth/get-session", () => {
      gets++;
      return queue.shift()?.() ?? HttpResponse.json(sessionOf(current));
    }),
  );
});

const as = (who: Who) => () => HttpResponse.json(sessionOf(who));
const unavailable = () => HttpResponse.json({ message: "unavailable" }, { status: 503 });
const stalled = () => new Promise<Response>(() => undefined);

// What the server put into the page for the person it rendered it for.
function dehydratedFor(who: Who) {
  const client = new QueryClient();
  client.setQueryData(["private-experiment"], `${who}'s private experiment`);
  return dehydrate(client);
}

let refetchSession: () => Promise<void> = () => Promise.resolve();
let cache: QueryClientType | undefined;
function Cache() {
  cache = useQueryClient();
  refetchSession = useSession().refetch;
  return null;
}
function Page() {
  const value = useQueryClient().getQueryData<string>(["private-experiment"]);
  return <p>{value ?? "nothing private"}</p>;
}

function renderPlatformFor(who: Who) {
  return render(
    <QueryProvider>
      <Cache />
      <PrincipalGate userId={idOf(who)}>
        <HydrationBoundary state={dehydratedFor(who)}>
          <Page />
        </HydrationBoundary>
      </PrincipalGate>
    </QueryProvider>,
  );
}

async function settle() {
  await act(async () => {
    await refetchSession();
  });
}

const switches: [Who, Who][] = [
  ["guest", "researcher"],
  ["researcher", "guest"],
  ["researcher", "signed-out"],
  ["guest", "signed-out"],
];

describe.each(switches)("rendered for the %s while the browser is %s", (renderedFor, browser) => {
  it("hides the page, drops its data and reloads once the session settles on a hard load", async () => {
    current = browser;
    renderPlatformFor(renderedFor);
    await settle();
    await waitFor(() => expect(reloadPage).toHaveBeenCalledOnce());
    expect(screen.queryByText(/private experiment/)).not.toBeInTheDocument();
    expect(cache?.getQueryData(["private-experiment"])).toBeUndefined();
  });

  it("never hydrates the page into the next person's cache after a switch", async () => {
    current = renderedFor;
    renderPlatformFor(renderedFor);
    await settle();
    expect(screen.getByText(`${renderedFor}'s private experiment`)).toBeInTheDocument();
    const before = cache;
    current = browser;
    await settle();
    await waitFor(() => expect(reloadPage).toHaveBeenCalledOnce());
    expect(cache).not.toBe(before);
    expect(screen.queryByText(/private experiment/)).not.toBeInTheDocument();
    expect(cache?.getQueryData(["private-experiment"])).toBeUndefined();
    expect(before?.getQueryData(["private-experiment"])).toBeUndefined();
  });
});

describe("the same person", () => {
  it("keeps the page and its server data, and never reloads", async () => {
    current = "researcher";
    renderPlatformFor("researcher");
    await settle();
    expect(screen.getByText("researcher's private experiment")).toBeInTheDocument();
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("keeps the page through a failed refetch", async () => {
    current = "researcher";
    renderPlatformFor("researcher");
    await settle();
    server.use(
      http.get("*/api/v1/auth/get-session", () =>
        HttpResponse.json({ message: "unauthorized" }, { status: 401 }),
      ),
    );
    await settle();
    expect(screen.getByText("researcher's private experiment")).toBeInTheDocument();
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("shows a recovery screen instead of reloading again when a mismatch survives a reload", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem("openjii.principal-reload", "researcher-a>guest-a");
    current = "guest";
    renderPlatformFor("researcher");
    await settle();

    expect(await screen.findByRole("alert")).toHaveTextContent("principalGate.title");
    expect(reloadPage).not.toHaveBeenCalled();
    expect(screen.queryByText(/private experiment/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "principalGate.signIn" })).toHaveAttribute(
      "href",
      "/en-US/login",
    );

    await user.click(screen.getByRole("button", { name: "principalGate.reload" }));
    expect(reloadPage).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem("openjii.principal-reload")).toBeNull();
  });
});

describe("a browser session that is only stale", () => {
  // The browser settles on the guest while the server, asked directly, says the researcher.
  async function renderStale(...answers: (() => Response | Promise<Response>)[]) {
    current = "researcher";
    renderPlatformFor("researcher");
    await settle();
    const before = gets;
    queue = [as("guest"), ...answers];
    await settle();
    return before;
  }

  it("reopens without a reload once the refreshed session agrees", async () => {
    await renderStale(as("researcher"), as("researcher"));

    expect(await screen.findByText("researcher's private experiment")).toBeInTheDocument();
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("offers recovery when the refresh keeps failing", async () => {
    const settled = await renderStale(
      ...Array.from({ length: 3 }, () => [as("researcher"), unavailable]).flat(),
    );

    expect(await screen.findByRole("alert", undefined, { timeout: 8_000 })).toHaveTextContent(
      "principalGate.title",
    );
    expect(gets - settled).toBe(7);
    expect(reloadPage).not.toHaveBeenCalled();
    expect(screen.queryByText(/private experiment/)).not.toBeInTheDocument();
  }, 15_000);

  it("offers recovery when the server cannot be asked", async () => {
    const settled = await renderStale(
      ...Array.from({ length: 3 }, () => () => HttpResponse.error()),
    );

    expect(await screen.findByRole("alert", undefined, { timeout: 8_000 })).toHaveTextContent(
      "principalGate.title",
    );
    expect(gets - settled).toBe(4);
    expect(reloadPage).not.toHaveBeenCalled();
  }, 15_000);

  it("offers recovery when the server never answers", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const settled = await renderStale(stalled, stalled, stalled);
      await waitFor(() => expect(gets - settled).toBe(2));
      for (let check = 0; check < 3; check++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(6_000);
        });
      }

      expect(screen.getByRole("alert")).toHaveTextContent("principalGate.title");
      expect(gets - settled).toBe(4);
      expect(reloadPage).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  }, 15_000);
});
