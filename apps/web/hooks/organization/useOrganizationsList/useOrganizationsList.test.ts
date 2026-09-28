import { createOrganizationDirectoryEntry } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
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
  });
});
