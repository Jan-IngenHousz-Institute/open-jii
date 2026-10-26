import { createOrganizationDirectoryEntry } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import * as nav from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { useOrganizationsList } from "./useOrganizationsList";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

function setSearchParams(qs: string): void {
  vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams(qs));
}

/** The array params as the API receives them, e.g. `type[0]=a&type[1]=b`. */
function arrayParam(url: string, key: string): string[] {
  const params = new URL(url).searchParams;
  return [...params.keys()]
    .filter((name) => name.startsWith(`${key}[`))
    .map((name) => params.get(name) ?? "");
}

// More than one client-side page (20 rows), so page 2 exists and is not clamped back to 1.
function mountTwoPages() {
  const organizations = Array.from({ length: 25 }, (_, index) =>
    createOrganizationDirectoryEntry({ id: `org-${index}`, name: `Org ${index}` }),
  );
  return server.mount(contract.organizations.listOrganizations, { body: { organizations } });
}

async function renderOnSecondPage() {
  const { result } = renderHook(() => useOrganizationsList());
  await waitFor(() => expect(result.current.totalPages).toBe(2));
  act(() => result.current.setPage(2));
  expect(result.current.page).toBe(2);
  return result;
}

describe("useOrganizationsList", () => {
  beforeEach(() => mockSession({ id: "user-1" }));
  afterEach(() => mockSession(null));

  describe("setSort", () => {
    it("sends the sort to the API and returns to the first page", async () => {
      const spy = mountTwoPages();
      const result = await renderOnSecondPage();

      act(() =>
        result.current.setSort([
          { field: "members", direction: "desc" },
          { field: "name", direction: "asc" },
        ]),
      );

      expect(result.current.page).toBe(1);
      expect(result.current.sort).toEqual([
        { field: "members", direction: "desc" },
        { field: "name", direction: "asc" },
      ]);
      await waitFor(() => {
        expect(spy.calls.at(-1)?.query).toMatchObject({
          "sort[0][field]": "members",
          "sort[0][direction]": "desc",
          "sort[1][field]": "name",
          "sort[1][direction]": "asc",
        });
      });
    });

    it("clears the sort from the API request and returns to the first page", async () => {
      const spy = mountTwoPages();
      const result = await renderOnSecondPage();

      act(() => result.current.setSort([{ field: "name", direction: "asc" }]));
      await waitFor(() => expect(spy.calls.at(-1)?.query["sort[0][field]"]).toBe("name"));

      act(() => result.current.setPage(2));
      act(() => result.current.setSort([]));

      expect(result.current.page).toBe(1);
      expect(result.current.sort).toEqual([]);
      await waitFor(() => expect(spy.calls.at(-1)?.query["sort[0][field]"]).toBeUndefined());
    });
  });

  describe("rows", () => {
    it("carries each organization's type, including none", async () => {
      server.mount(contract.organizations.listOrganizations, {
        body: {
          organizations: [
            createOrganizationDirectoryEntry({ id: "typed", type: "non_profit" }),
            createOrganizationDirectoryEntry({ id: "untyped", type: null }),
          ],
        },
      });

      const { result } = renderHook(() => useOrganizationsList());

      await waitFor(() => expect(result.current.organizations).toHaveLength(2));
      expect(result.current.organizations.map(({ id, type }) => ({ id, type }))).toEqual([
        { id: "typed", type: "non_profit" },
        { id: "untyped", type: null },
      ]);
    });
  });

  describe("type filter", () => {
    it("reads the types from the URL and sends them to the API", async () => {
      setSearchParams("type=university,non_profit");
      const spy = server.mount(contract.organizations.listOrganizations, {
        body: { organizations: [] },
      });

      const { result } = renderHook(() => useOrganizationsList());

      expect(result.current.types).toEqual(["university", "non_profit"]);
      expect(result.current.hasActiveFilters).toBe(true);
      await waitFor(() => expect(spy.called).toBe(true));
      expect(arrayParam(spy.calls.at(-1)?.url ?? "", "type")).toEqual(["university", "non_profit"]);
    });

    it("sends no type while nothing is picked", async () => {
      const spy = server.mount(contract.organizations.listOrganizations, {
        body: { organizations: [] },
      });

      const { result } = renderHook(() => useOrganizationsList());

      expect(result.current.types).toEqual([]);
      expect(result.current.hasActiveFilters).toBe(false);
      await waitFor(() => expect(spy.called).toBe(true));
      expect(arrayParam(spy.calls.at(-1)?.url ?? "", "type")).toEqual([]);
    });

    it("returns to the first page when the types change", async () => {
      const spy = mountTwoPages();
      const result = await renderOnSecondPage();

      act(() => result.current.setTypes(["university"]));

      expect(result.current.page).toBe(1);
      expect(result.current.types).toEqual(["university"]);
      await waitFor(() =>
        expect(arrayParam(spy.calls.at(-1)?.url ?? "", "type")).toEqual(["university"]),
      );
    });

    it("clears the types and returns to the first page, keeping search and sort", async () => {
      setSearchParams("q=soil&type=university");
      mountTwoPages();
      const { result } = renderHook(() => useOrganizationsList());
      await waitFor(() => expect(result.current.totalPages).toBe(2));

      act(() => result.current.toggleSort("name", false));
      act(() => result.current.setPage(2));
      act(() => result.current.clearFilters());

      expect(result.current.page).toBe(1);
      expect(result.current.types).toEqual([]);
      expect(result.current.hasActiveFilters).toBe(false);
      expect(result.current.search).toBe("soil");
      expect(result.current.sort).toEqual([{ field: "name", direction: "asc" }]);
    });
  });

  describe("toggleSort", () => {
    it("sorts ascending on the first toggle and returns to the first page", async () => {
      const spy = mountTwoPages();
      const result = await renderOnSecondPage();

      act(() => result.current.toggleSort("resources", false));

      expect(result.current.page).toBe(1);
      expect(result.current.sort).toEqual([{ field: "resources", direction: "asc" }]);
      await waitFor(() => {
        expect(spy.calls.at(-1)?.query).toMatchObject({
          "sort[0][field]": "resources",
          "sort[0][direction]": "asc",
        });
      });
    });

    it("adds type as the second sort on a multi toggle", async () => {
      const spy = mountTwoPages();
      const result = await renderOnSecondPage();

      act(() => result.current.toggleSort("name", false));
      act(() => result.current.setPage(2));
      act(() => result.current.toggleSort("type", true));

      expect(result.current.page).toBe(1);
      expect(result.current.sort).toEqual([
        { field: "name", direction: "asc" },
        { field: "type", direction: "asc" },
      ]);
      await waitFor(() => {
        expect(spy.calls.at(-1)?.query).toMatchObject({
          "sort[0][field]": "name",
          "sort[0][direction]": "asc",
          "sort[1][field]": "type",
          "sort[1][direction]": "asc",
        });
      });
    });
  });
});
