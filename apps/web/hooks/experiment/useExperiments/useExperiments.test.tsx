import { createExperiment } from "@/test/factories";
import { arrayParam, listEnvelope, openOnUrl } from "@/test/list-request";
import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperiments } from "./useExperiments";

const sort = encodeURIComponent(JSON.stringify([{ field: "name", direction: "asc" }]));

describe("useExperiments", () => {
  it("uses a shared link's search in the first request", async () => {
    openOnUrl("/platform/experiments", "q=wheat");
    const spy = server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });

    const { result } = renderHook(() => useExperiments());

    expect(result.current.search).toBe("wheat");
    expect(result.current.debouncedSearch).toBe("wheat");
    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls[0]?.query.search).toBe("wheat");
  });

  it("returns the experiments from the API", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: listEnvelope([createExperiment({ id: "e-1", name: "E1" })]),
    });

    const { result } = renderHook(() => useExperiments());

    await waitFor(() => expect(result.current.data?.items[0]?.name).toBe("E1"));
  });

  it("sends the URL's status, visibility and sort, the page and the search", async () => {
    openOnUrl("/platform/experiments", `status=active,stale&visibility=public&sort=${sort}`);
    const spy = server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });

    const { result } = renderHook(() => useExperiments());
    act(() => result.current.setSearch("wheat"));

    await waitFor(() => expect(spy.calls.at(-1)?.query.search).toBe("wheat"));
    const call = spy.calls.at(-1);
    expect(arrayParam(call?.url ?? "", "status")).toEqual(["active", "stale"]);
    expect(arrayParam(call?.url ?? "", "visibility")).toEqual(["public"]);
    expect(call?.query["sort[0][field]"]).toBe("name");
    expect(call?.query.page).toBe("1");
    expect(call?.query.scope).toBeUndefined();
  });

  it("sends no filter or sort while nothing is picked", async () => {
    openOnUrl("/platform/experiments", "");
    const spy = server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });

    renderHook(() => useExperiments());

    await waitFor(() => expect(spy.called).toBe(true));
    const url = spy.calls.at(-1)?.url ?? "";
    expect(arrayParam(url, "status")).toEqual([]);
    expect(arrayParam(url, "visibility")).toEqual([]);
    expect(url).not.toContain("sort");
  });

  describe("archive", () => {
    it("restores search alongside the archived status in the first request", async () => {
      openOnUrl("/platform/experiments-archive", "q=lighting");
      const spy = server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });

      const { result } = renderHook(() => useExperiments({ archived: true }));

      expect(result.current.search).toBe("lighting");
      await waitFor(() => expect(spy.called).toBe(true));
      expect(spy.calls[0]?.query.search).toBe("lighting");
      expect(arrayParam(spy.calls[0]?.url ?? "", "status")).toEqual(["archived"]);
    });

    it("asks for related archived experiments and applies visibility", async () => {
      openOnUrl("/platform/experiments-archive", "visibility=public");
      const spy = server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });

      renderHook(() => useExperiments({ archived: true }));

      await waitFor(() => expect(spy.called).toBe(true));
      const call = spy.calls.at(-1);
      expect(call?.query.scope).toBe("related");
      expect(arrayParam(call?.url ?? "", "status")).toEqual(["archived"]);
      expect(arrayParam(call?.url ?? "", "visibility")).toEqual(["public"]);
    });

    it("neither applies nor counts a stray status param", async () => {
      openOnUrl("/platform/experiments-archive", "status=active");
      const spy = server.mount(contract.experiments.listExperiments, { body: listEnvelope([]) });

      const { result } = renderHook(() => useExperiments({ archived: true }));

      expect(result.current.filters.status).toEqual([]);
      expect(result.current.hasActiveFilters).toBe(false);
      await waitFor(() => expect(spy.called).toBe(true));
      expect(arrayParam(spy.calls.at(-1)?.url ?? "", "status")).toEqual(["archived"]);
    });
  });
});
