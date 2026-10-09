import type { DehydratedState } from "@tanstack/react-query";
import { isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrefetchedQueries } from "./prefetched-queries";

const listExperiments = vi.hoisted(() => vi.fn());
const getWorkbook = vi.hoisted(() => vi.fn());

vi.mock("~/lib/server-orpc", () => ({
  createServerOrpcClient: () =>
    Promise.resolve({ experiments: { listExperiments }, workbooks: { getWorkbook } }),
}));

function embeddedKeys(element: unknown): unknown[] {
  if (!isValidElement<{ state: DehydratedState }>(element)) {
    throw new Error("PrefetchedQueries rendered no element");
  }
  return element.props.state.queries.map((query) => query.queryKey);
}

describe("PrefetchedQueries", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("embeds what the server fetched under the keys the client hooks use", async () => {
    listExperiments.mockResolvedValue({ items: [] });

    const element = await PrefetchedQueries({
      queries: (utils) => [
        utils.experiments.listExperiments.queryOptions({ input: { scope: "related" } }),
      ],
      children: null,
    });

    expect(listExperiments).toHaveBeenCalledWith({ scope: "related" }, expect.anything());
    expect(JSON.stringify(embeddedKeys(element))).toContain("listExperiments");
  });

  it("clears its one-second budget when the fetches finish first", async () => {
    listExperiments.mockResolvedValue({ items: [] });
    const setTimer = vi.spyOn(globalThis, "setTimeout");
    const clearTimer = vi.spyOn(globalThis, "clearTimeout");

    await PrefetchedQueries({
      queries: (utils) => [
        utils.experiments.listExperiments.queryOptions({ input: { scope: "related" } }),
      ],
      children: null,
    });

    const budgetCall = setTimer.mock.calls.findIndex(([, delay]) => delay === 1000);
    expect(clearTimer).toHaveBeenCalledWith(setTimer.mock.results[budgetCall]?.value);
    setTimer.mockRestore();
    clearTimer.mockRestore();
  });

  it("leaves out a query slower than the budget, for the browser to fetch", async () => {
    vi.useFakeTimers();
    listExperiments.mockResolvedValue({ items: [] });
    getWorkbook.mockReturnValue(new Promise(() => undefined));

    const rendering = PrefetchedQueries({
      queries: (utils) => [
        utils.experiments.listExperiments.queryOptions({ input: { scope: "related" } }),
        utils.workbooks.getWorkbook.queryOptions({ input: { id: "wb-1" } }),
      ],
      children: null,
    });
    await vi.advanceTimersByTimeAsync(1000);
    const keys = JSON.stringify(embeddedKeys(await rendering));

    expect(keys).toContain("listExperiments");
    expect(keys).not.toContain("getWorkbook");
  });

  it("leaves out a result the page should not render on the server", async () => {
    listExperiments.mockResolvedValue({ items: [] });
    getWorkbook.mockResolvedValue({ id: "wb-1", cells: [] });

    const element = await PrefetchedQueries({
      queries: (utils) => [
        utils.experiments.listExperiments.queryOptions({ input: { scope: "related" } }),
        utils.workbooks.getWorkbook.queryOptions({ input: { id: "wb-1" } }),
      ],
      embedWhen: (data) => !(typeof data === "object" && data !== null && "cells" in data),
      children: null,
    });
    const keys = JSON.stringify(embeddedKeys(element));

    expect(keys).toContain("listExperiments");
    expect(keys).not.toContain("getWorkbook");
  });
});
