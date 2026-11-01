import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { QueryProvider } from "../QueryProvider";

const auth = vi.hoisted<{ id: string | null }>(() => ({ id: "researcher" }));
vi.mock("@repo/auth/client", () => ({
  useSession: () => ({ data: auth.id ? { user: { id: auth.id } } : null, isPending: false }),
}));

it("changes identity before rendering and never restores a prior private response", async () => {
  let current = new QueryClient();
  function Capture() {
    current = useQueryClient();
    return <span>{current.getQueryData<string>(["private-experiment"]) ?? "empty"}</span>;
  }
  const view = render(
    <QueryProvider>
      <Capture />
    </QueryProvider>,
  );
  const researcher = current;
  researcher.setQueryData(["private-experiment"], "Private research");
  let resolve!: (value: string) => void;
  const delayed = researcher
    .fetchQuery({
      queryKey: ["private-workbook"],
      queryFn: () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    })
    .catch(() => undefined);
  auth.id = null;
  view.rerender(
    <QueryProvider>
      <Capture />
    </QueryProvider>,
  );
  expect(current).not.toBe(researcher);
  expect(view.getByText("empty")).toBeInTheDocument();
  auth.id = "guest-a";
  view.rerender(
    <QueryProvider>
      <Capture />
    </QueryProvider>,
  );
  const guestA = current;
  guestA.setQueryData(["private-experiment"], "Guest A result");
  auth.id = "guest-b";
  view.rerender(
    <QueryProvider>
      <Capture />
    </QueryProvider>,
  );
  await act(async () => {
    resolve("Late private workbook");
    await delayed;
  });
  expect(current).not.toBe(guestA);
  expect(current.getQueryData(["private-workbook"])).toBeUndefined();
  expect(current.getQueryData(["private-experiment"])).toBeUndefined();
  expect(researcher.getQueryCache().getAll()).toHaveLength(0);
  expect(guestA.getQueryCache().getAll()).toHaveLength(0);
});

it("reattaches mounted query observers to the new identity client", async () => {
  auth.id = "researcher-observer";
  const read = vi.fn(async () => Promise.resolve(auth.id));
  function PrivatePanel() {
    const result = useQuery({ queryKey: ["private-panel"], queryFn: read });
    return <span>{result.data ?? "loading"}</span>;
  }
  const view = render(
    <QueryProvider>
      <PrivatePanel />
    </QueryProvider>,
  );
  await screen.findByText("researcher-observer");
  auth.id = "guest-observer";
  view.rerender(
    <QueryProvider>
      <PrivatePanel />
    </QueryProvider>,
  );
  expect(screen.queryByText("researcher-observer")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("guest-observer")).toBeInTheDocument());
  expect(read).toHaveBeenCalledTimes(2);
});
