import { useQueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";

import type { useSession as UseSession } from "@repo/auth/client";

import { server } from "../../test/msw/server";

// The real better-auth client, so pending, resolved and failed refetches are its own
// transitions. It binds `fetch` when it loads, so it loads after msw is listening.
vi.unmock("@repo/auth/client");

let useSession: typeof UseSession;
let QueryProvider: (props: { children: ReactNode }) => ReactNode;

beforeAll(async () => {
  ({ useSession } = await import("@repo/auth/client"));
  ({ QueryProvider } = await import("../QueryProvider"));
});

const sessionFor = (id: string) => ({
  user: { id, email: `${id}@example.org`, name: id, isAnonymous: false },
  session: { id: `session-${id}`, userId: id, expiresAt: "2099-01-01T00:00:00.000Z" },
});

let respond: () => Response;
let calls = 0;

beforeEach(() => {
  calls = 0;
  respond = () => HttpResponse.json(sessionFor("researcher"));
  server.use(
    http.get("*/api/v1/auth/get-session", () => {
      calls++;
      return respond();
    }),
  );
});

let mounts = 0;
let refetchSession: () => Promise<void> = () => Promise.resolve();
function Probe() {
  const client = useQueryClient();
  const { data, isPending, error, refetch } = useSession();
  refetchSession = () => refetch();
  const [draft] = useState(() => `draft-${++mounts}`);
  useEffect(() => {
    client.setQueryData(["mounted"], draft);
  }, [client, draft]);
  return (
    <span>
      {`${draft}|${data?.user.id ?? (isPending ? "pending" : "none")}|${error ? "error" : "ok"}`}
    </span>
  );
}

it("keeps the tree and its cache while a hard load's session resolves", async () => {
  mounts = 0;
  let client: ReturnType<typeof useQueryClient> | undefined;
  function Capture() {
    client = useQueryClient();
    return null;
  }
  render(
    <QueryProvider>
      <Capture />
      <Probe />
    </QueryProvider>,
  );
  expect(screen.getByText("draft-1|pending|ok")).toBeInTheDocument();
  const first = client;
  first?.setQueryData(["hydrated"], "from the server render");
  await screen.findByText("draft-1|researcher|ok", undefined, { timeout: 1500 });
  expect(mounts).toBe(1);
  expect(client).toBe(first);
  expect(client?.getQueryData(["hydrated"])).toBe("from the server render");
});

async function renderSignedIn() {
  render(
    <QueryProvider>
      <Probe />
    </QueryProvider>,
  );
  // The session atom outlives a test by a second, so each test settles it itself.
  await act(async () => {
    await refetchSession();
  });
  await screen.findByText(/\|researcher\|ok$/, undefined, { timeout: 1500 });
  return mounts;
}

it.each([
  ["a server error", () => HttpResponse.json({ message: "unavailable" }, { status: 503 })],
  ["a 401", () => HttpResponse.json({ message: "unauthorized" }, { status: 401 })],
  ["a network failure", () => HttpResponse.error()],
])("keeps identity and the tree when a refetch fails with %s", async (_, failure) => {
  const mounted = await renderSignedIn();
  respond = failure;
  const before = calls;
  await act(async () => {
    await refetchSession();
  });
  await waitFor(() => expect(calls).toBeGreaterThan(before));
  await screen.findByText(/\|error$/, undefined, { timeout: 1500 });
  respond = () => HttpResponse.json(sessionFor("researcher"));
  await act(async () => {
    await refetchSession();
  });
  await screen.findByText(/\|researcher\|ok$/, undefined, { timeout: 1500 });
  expect(mounts).toBe(mounted);
});

it("switches the client and tree when the session really changes", async () => {
  const mounted = await renderSignedIn();
  respond = () => HttpResponse.json(sessionFor("guest"));
  await act(async () => {
    await refetchSession();
  });
  await screen.findByText(/\|guest\|ok$/, undefined, { timeout: 1500 });
  expect(mounts).toBe(mounted + 1);
});
