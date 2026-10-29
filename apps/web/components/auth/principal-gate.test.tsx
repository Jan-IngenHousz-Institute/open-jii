import { HydrationBoundary, QueryClient, dehydrate, useQueryClient } from "@tanstack/react-query";
import type { QueryClient as QueryClientType } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
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
beforeEach(() => {
  gets = 0;
  reloadPage.mockClear();
  window.sessionStorage.clear();
  server.use(
    http.get("*/api/v1/auth/get-session", () => {
      gets++;
      return HttpResponse.json(sessionOf(current));
    }),
  );
});

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

  it("stops reloading when the same mismatch survives a reload", async () => {
    window.sessionStorage.setItem("openjii.principal-reload", "researcher-a>guest-a");
    current = "guest";
    renderPlatformFor("researcher");
    await settle();
    await waitFor(() => expect(gets).toBeGreaterThan(1));
    expect(reloadPage).not.toHaveBeenCalled();
    expect(screen.queryByText(/private experiment/)).not.toBeInTheDocument();
  });
});
