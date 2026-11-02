import { createProtocol } from "@/test/factories";
import { arrayParam, listEnvelope, openOnUrl } from "@/test/list-request";
import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useProtocols } from "./useProtocols";

const sort = encodeURIComponent(JSON.stringify([{ field: "name", direction: "asc" }]));

describe("useProtocols", () => {
  it("returns the protocols from the API", async () => {
    server.mount(contract.protocols.listProtocols, {
      body: listEnvelope([createProtocol({ id: "p-1", name: "P1" })]),
    });

    const { result } = renderHook(() => useProtocols());

    await waitFor(() => expect(result.current.data?.items[0]?.name).toBe("P1"));
  });

  it("sends the URL's family, visibility and sort, the page and the search", async () => {
    openOnUrl("/platform/protocols", `family=ambyte,multispeq&visibility=private&sort=${sort}`);
    const spy = server.mount(contract.protocols.listProtocols, { body: listEnvelope([]) });

    const { result } = renderHook(() => useProtocols());
    act(() => result.current.setSearch("fluor"));

    await waitFor(() => expect(spy.calls.at(-1)?.query.search).toBe("fluor"));
    const call = spy.calls.at(-1);
    expect(arrayParam(call?.url ?? "", "family")).toEqual(["ambyte", "multispeq"]);
    expect(arrayParam(call?.url ?? "", "visibility")).toEqual(["private"]);
    expect(call?.query["sort[0][field]"]).toBe("name");
    expect(call?.query.page).toBe("1");
  });

  it("sends no filter, sort or blank search while nothing is picked", async () => {
    openOnUrl("/platform/protocols", "");
    const spy = server.mount(contract.protocols.listProtocols, { body: listEnvelope([]) });

    const { result } = renderHook(() => useProtocols());
    act(() => result.current.setSearch("   "));

    await waitFor(() => expect(spy.called).toBe(true));
    const url = spy.calls.at(-1)?.url ?? "";
    expect(arrayParam(url, "family")).toEqual([]);
    expect(arrayParam(url, "visibility")).toEqual([]);
    expect(url).not.toContain("sort");
    expect(spy.calls.at(-1)?.query.search).toBeUndefined();
  });
});
