import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NOW, stubStatusFetch } from "~/test/render-status";
import { operationalStatusDocument, staleStatusDocument } from "~/test/status-fixtures";

import { useStatusDocument } from "../use-status-document";

const SERVER_NOW = "Tue, 03 Nov 2026 12:00:00 GMT";
const TWO_MINUTES_MS = 120_000;

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function mountWith(initial: Parameters<typeof stubStatusFetch>[0], serverDate?: string) {
  vi.useFakeTimers({ now: NOW });
  const stub = stubStatusFetch(initial, serverDate);
  const hook = renderHook(() => useStatusDocument());
  await advance(0);

  return { ...stub, hook };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(window.document, "visibilityState", { configurable: true, value: state });
  window.document.dispatchEvent(new Event("visibilitychange"));
}

describe("useStatusDocument", () => {
  describe("fetching", () => {
    it("fetches on mount without the cache and again every minute", async () => {
      const { fetchMock, hook } = await mountWith(operationalStatusDocument);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "/data/status.json",
        expect.objectContaining({ cache: "no-store" }),
      );
      expect(hook.result.current.document?.generatedAt).toBe(operationalStatusDocument.generatedAt);

      await advance(60_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await advance(60_000);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("gives up on a first fetch that hangs for ten seconds", async () => {
      const { hook } = await mountWith("pending");

      await advance(9_999);
      expect(hook.result.current.hasFailed).toBe(false);

      await advance(1);
      expect(hook.result.current).toMatchObject({ document: undefined, hasFailed: true });
    });

    it("fetches again when the tab becomes visible", async () => {
      const { fetchMock } = await mountWith(operationalStatusDocument);

      setVisibility("visible");

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not fetch when the tab is hidden", async () => {
      const { fetchMock } = await mountWith(operationalStatusDocument);

      setVisibility("hidden");

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("fetches again when the browser comes back online", async () => {
      const { fetchMock } = await mountWith(operationalStatusDocument);

      window.dispatchEvent(new Event("online"));

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("failures", () => {
    it("reports a failure when no document ever loaded", async () => {
      const { hook } = await mountWith("fails");

      expect(hook.result.current).toMatchObject({ document: undefined, hasFailed: true });
    });

    it.each(["fails", "http-error", "garbage"] as const)(
      "keeps the last good document when a refresh %s",
      async (failure) => {
        const { respondWith, hook } = await mountWith(operationalStatusDocument);

        respondWith(failure);
        await advance(60_000);

        expect(hook.result.current.hasFailed).toBe(true);
        expect(hook.result.current.document?.generatedAt).toBe(
          operationalStatusDocument.generatedAt,
        );
      },
    );

    it("clears the failure once a refresh succeeds", async () => {
      const { respondWith, hook } = await mountWith("fails");

      respondWith(operationalStatusDocument);
      await advance(60_000);

      expect(hook.result.current.hasFailed).toBe(false);
      expect(hook.result.current.document).toBeDefined();
    });

    it("treats a document with no components as a failure", async () => {
      const { hook } = await mountWith({ ...operationalStatusDocument, components: [] });

      expect(hook.result.current).toMatchObject({ document: undefined, hasFailed: true });
    });
  });

  describe("which document is held", () => {
    it("drops a component this page does not know instead of failing", async () => {
      const [website] = operationalStatusDocument.components;
      const { hook } = await mountWith({
        raw: {
          ...operationalStatusDocument,
          components: [...operationalStatusDocument.components, { ...website, id: "mobile-app" }],
        },
      });

      expect(hook.result.current.hasFailed).toBe(false);
      expect(hook.result.current.document?.components).toHaveLength(5);
    });

    it("never replaces a document with an older one", async () => {
      const { respondWith, hook } = await mountWith(operationalStatusDocument);

      respondWith(staleStatusDocument);
      await advance(60_000);

      expect(hook.result.current.document?.generatedAt).toBe(operationalStatusDocument.generatedAt);
      expect(hook.result.current.hasFailed).toBe(false);
    });

    it("replaces a document with a newer one", async () => {
      const { respondWith, hook } = await mountWith(staleStatusDocument);

      respondWith(operationalStatusDocument);
      await advance(60_000);

      expect(hook.result.current.document?.generatedAt).toBe(operationalStatusDocument.generatedAt);
    });

    it("keeps the same object for a document that has not changed", async () => {
      const { hook } = await mountWith(operationalStatusDocument);
      const held = hook.result.current.document;

      await advance(60_000);

      expect(hook.result.current.document).toBe(held);
    });
  });

  describe("the server's clock", () => {
    it("is how far the response's Date header is from the device clock", async () => {
      const { hook } = await mountWith(operationalStatusDocument, SERVER_NOW);

      expect(hook.result.current.serverOffsetMs).toBe(-TWO_MINUTES_MS);
    });

    it("adds the Age of a response the CDN served from its cache", async () => {
      vi.useFakeTimers({ now: NOW });
      const { setServerAge } = stubStatusFetch(operationalStatusDocument, SERVER_NOW);
      setServerAge(25);
      const hook = renderHook(() => useStatusDocument());
      await advance(0);

      expect(hook.result.current.serverOffsetMs).toBe(-TWO_MINUTES_MS + 25_000);
    });

    it("is no offset when the response has no Date header", async () => {
      const { hook } = await mountWith(operationalStatusDocument);

      expect(hook.result.current.serverOffsetMs).toBe(0);
    });

    it("keeps the last offset when a later Date header cannot be read", async () => {
      const { setServerDate, hook } = await mountWith(staleStatusDocument, SERVER_NOW);

      setServerDate("not a date");
      await advance(60_000);

      expect(hook.result.current.serverOffsetMs).toBe(-TWO_MINUTES_MS);
    });

    it("follows a later Date header", async () => {
      const { setServerDate, hook } = await mountWith(operationalStatusDocument, SERVER_NOW);

      setServerDate("Tue, 03 Nov 2026 12:03:00 GMT");
      await advance(60_000);

      expect(hook.result.current.serverOffsetMs).toBe(3 * 60_000 - 2 * 60_000 - 60_000);
    });
  });

  describe("on unmount", () => {
    it("aborts the request in flight", async () => {
      const { fetchMock, hook } = await mountWith("pending");
      const signal = fetchMock.mock.calls[0]?.[1]?.signal;

      hook.unmount();

      expect(signal?.aborted).toBe(true);
    });

    it("stops the refresh timer", async () => {
      const { hook } = await mountWith(operationalStatusDocument);
      expect(vi.getTimerCount()).toBe(1);

      hook.unmount();

      expect(vi.getTimerCount()).toBe(0);
    });

    it("stops listening for the tab and the network", async () => {
      const { fetchMock, hook } = await mountWith(operationalStatusDocument);

      hook.unmount();
      setVisibility("visible");
      window.dispatchEvent(new Event("online"));

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not report a failure for the request it aborted", async () => {
      const { hook } = await mountWith("pending");

      hook.unmount();
      await advance(10_000);

      expect(hook.result.current.hasFailed).toBe(false);
    });
  });
});
