import { createWorkbook } from "@/test/factories";
import { arrayParam, listEnvelope, openOnUrl } from "@/test/list-request";
import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useWorkbooks } from "./useWorkbooks";

const sort = encodeURIComponent(JSON.stringify([{ field: "name", direction: "asc" }]));

describe("useWorkbooks", () => {
  it("returns the workbooks from the API", async () => {
    server.mount(contract.workbooks.listWorkbooks, {
      body: listEnvelope([createWorkbook({ id: "w-1", name: "W1" })]),
    });

    const { result } = renderHook(() => useWorkbooks());

    await waitFor(() => expect(result.current.data?.items[0]?.name).toBe("W1"));
  });

  it("sends the URL's visibility and sort, the page and the search", async () => {
    openOnUrl("/platform/workbooks", `visibility=private,public&sort=${sort}`);
    const spy = server.mount(contract.workbooks.listWorkbooks, { body: listEnvelope([]) });

    const { result } = renderHook(() => useWorkbooks());
    act(() => result.current.setSearch("soil"));

    await waitFor(() => expect(spy.calls.at(-1)?.query.search).toBe("soil"));
    const call = spy.calls.at(-1);
    expect(arrayParam(call?.url ?? "", "visibility")).toEqual(["private", "public"]);
    expect(call?.query["sort[0][field]"]).toBe("name");
    expect(call?.query.page).toBe("1");
  });

  it("sends no filter or sort while nothing is picked", async () => {
    openOnUrl("/platform/workbooks", "");
    const spy = server.mount(contract.workbooks.listWorkbooks, { body: listEnvelope([]) });

    renderHook(() => useWorkbooks());

    await waitFor(() => expect(spy.called).toBe(true));
    const url = spy.calls.at(-1)?.url ?? "";
    expect(arrayParam(url, "visibility")).toEqual([]);
    expect(url).not.toContain("sort");
  });
});
