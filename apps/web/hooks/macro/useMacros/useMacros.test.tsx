import { createMacro } from "@/test/factories";
import { arrayParam, listEnvelope, openOnUrl } from "@/test/list-request";
import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useMacros } from "./useMacros";

const sort = encodeURIComponent(JSON.stringify([{ field: "name", direction: "asc" }]));

describe("useMacros", () => {
  it("returns the macros from the API", async () => {
    server.mount(contract.macros.listMacros, {
      body: listEnvelope([createMacro({ id: "m-1", name: "M1" })]),
    });

    const { result } = renderHook(() => useMacros());

    await waitFor(() => expect(result.current.data?.items[0]?.name).toBe("M1"));
  });

  it("sends the URL's language, visibility and sort, the page and the search", async () => {
    openOnUrl("/platform/macros", `language=python,r&visibility=public&sort=${sort}`);
    const spy = server.mount(contract.macros.listMacros, { body: listEnvelope([]) });

    const { result } = renderHook(() => useMacros());
    act(() => result.current.setSearch("anova"));

    await waitFor(() => expect(spy.calls.at(-1)?.query.search).toBe("anova"));
    const call = spy.calls.at(-1);
    expect(arrayParam(call?.url ?? "", "language")).toEqual(["python", "r"]);
    expect(arrayParam(call?.url ?? "", "visibility")).toEqual(["public"]);
    expect(call?.query["sort[0][field]"]).toBe("name");
    expect(call?.query.page).toBe("1");
  });

  it("sends no filter or sort while nothing is picked", async () => {
    openOnUrl("/platform/macros", "");
    const spy = server.mount(contract.macros.listMacros, { body: listEnvelope([]) });

    renderHook(() => useMacros());

    await waitFor(() => expect(spy.called).toBe(true));
    const url = spy.calls.at(-1)?.url ?? "";
    expect(arrayParam(url, "language")).toEqual([]);
    expect(arrayParam(url, "visibility")).toEqual([]);
    expect(url).not.toContain("sort");
  });
});
