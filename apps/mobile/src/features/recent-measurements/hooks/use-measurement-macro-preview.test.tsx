import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredMeasurement } from "~/shared/db/measurements-storage";

import { useMeasurementMacroPreview } from "./use-measurement-macro-preview";

vi.mock("~/shared/stores/device-identity-store", () => ({
  getLocalThingName: () => "mobile-test-thing",
}));
vi.mock("expo-application", () => ({ nativeApplicationVersion: "2.4.1" }));

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }));

// The hook reads listExperiments (via useExperimentWorkbookRef) and
// getWorkbookVersion (via useWorkbookVersionQuery); tag each endpoint's
// options so the single useQuery mock can return per-endpoint results.
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: (opts: unknown) => useQueryMock(opts) };
});

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    experiments: {
      listExperiments: { queryOptions: (o: object) => ({ __kind: "list", ...o }) },
    },
    workbooks: {
      getWorkbookVersion: { queryOptions: (o: object) => ({ __kind: "version", ...o }) },
    },
  },
}));

const EXPERIMENT_ID = "11111111-1111-1111-1111-111111111111";
const PROTOCOL_ID = "22222222-2222-2222-2222-222222222222";
const TOPIC = `experiment/data_ingest/v1/${EXPERIMENT_ID}/multispeq/v1.0/client-1/${PROTOCOL_ID}`;

const payload = {
  macros: [{ id: "macro-1", name: "Phi2", filename: "macro-1.js" }],
  workbook_version_id: "version-1",
  macro_context: JSON.stringify({ upstream: { phi2: 0.5 } }),
  sample: [{ phi2: 0.8 }],
};

const stored: StoredMeasurement = {
  id: "m1",
  status: "successful",
  data: {
    topic: TOPIC,
    measurementResult: payload,
    metadata: { experimentName: "Exp", protocolName: "proto", timestamp: "2026-08-01T10:00:00Z" },
  },
};

const version = {
  cells: [
    {
      id: "cell-1",
      type: "macro",
      payload: { macroId: "macro-1", language: "python", name: "Phi2" },
    },
  ],
  entitySnapshots: { protocols: {}, macros: { "macro-1": { code: "cHJpbnQoMSk=" } } },
};

const results = {
  list: { data: undefined, isLoading: false } as Record<string, unknown>,
  version: { data: undefined, isLoading: false, error: null } as Record<string, unknown>,
};

beforeEach(() => {
  vi.clearAllMocks();
  results.list = { data: [{ id: EXPERIMENT_ID, workbookId: "w1" }], isLoading: false };
  results.version = { data: version, isLoading: false, error: null };
  useQueryMock.mockImplementation((opts: { __kind: "list" | "version" }) => results[opts.__kind]);
});

describe("useMeasurementMacroPreview", () => {
  it("resolves the macro snapshot, the restored payload and the recorded ctx", () => {
    const { result } = renderHook(() => useMeasurementMacroPreview(stored));

    expect(result.current).toEqual({
      status: "ready",
      preview: {
        macro: { code: "cHJpbnQoMSk=", language: "python" },
        macroId: "macro-1",
        workbookVersionId: "version-1",
        rawMeasurement: { sample: [{ phi2: 0.8 }] },
        ctx: { upstream: { phi2: 0.5 } },
      },
    });
  });

  it("is loading while the experiment list or the version read is pending", () => {
    results.list = { data: undefined, isLoading: true };
    const { result, rerender } = renderHook(() => useMeasurementMacroPreview(stored));
    expect(result.current).toEqual({ status: "loading" });

    results.list = { data: [{ id: EXPERIMENT_ID, workbookId: "w1" }], isLoading: false };
    results.version = { data: undefined, isLoading: true, error: null };
    rerender();
    expect(result.current).toEqual({ status: "loading" });
  });

  it("reports experiment-unavailable when the experiment left the member list", () => {
    results.list = { data: [], isLoading: false };

    const { result } = renderHook(() => useMeasurementMacroPreview(stored));

    expect(result.current).toEqual({ status: "unavailable", blocker: "experiment-unavailable" });
  });

  it("reads a failed experiment-list read as offline, not as a missing experiment", () => {
    results.list = { data: undefined, isLoading: false, error: new Error("network down") };

    const { result } = renderHook(() => useMeasurementMacroPreview(stored));

    expect(result.current).toEqual({ status: "unavailable", blocker: "offline" });
  });

  it("keeps offline for the genuinely failed version read", () => {
    results.version = { data: undefined, isLoading: false, error: new Error("network down") };

    const { result } = renderHook(() => useMeasurementMacroPreview(stored));

    expect(result.current).toEqual({ status: "unavailable", blocker: "offline" });
  });

  it("reads a paused retry as offline, not as a missing version", () => {
    // offlineFirst pauses the retry when the network is unreachable: no data,
    // no error, not loading — only isPaused says why.
    results.version = { data: undefined, isLoading: false, error: null, isPaused: true };

    const { result } = renderHook(() => useMeasurementMacroPreview(stored));

    expect(result.current).toEqual({ status: "unavailable", blocker: "offline" });
  });

  it("reads a 404 as the version being gone, not as offline", () => {
    const notFound = Object.assign(new Error("not found"), { status: 404 });
    results.version = { data: undefined, isLoading: false, error: notFound };

    const { result } = renderHook(() => useMeasurementMacroPreview(stored));

    expect(result.current).toEqual({ status: "unavailable", blocker: "version-unavailable" });
  });

  it("reports version-unavailable when the read succeeds but returns nothing", () => {
    results.version = { data: undefined, isLoading: false, error: null };

    const { result } = renderHook(() => useMeasurementMacroPreview(stored));

    expect(result.current).toEqual({ status: "unavailable", blocker: "version-unavailable" });
  });

  it("reports macro-not-found when the version has no snapshot of the macro", () => {
    results.version = {
      data: { cells: [], entitySnapshots: { protocols: {}, macros: {} } },
      isLoading: false,
      error: null,
    };

    const { result } = renderHook(() => useMeasurementMacroPreview(stored));

    expect(result.current).toEqual({ status: "unavailable", blocker: "macro-not-found" });
  });

  it("reports macro-not-found when the snapshot has no macro cell, rather than running Python as JS", () => {
    // publish-version snapshots exactly the macros its cells reference, so a
    // snapshot without a cell is inconsistent state — not a JavaScript macro.
    results.version = {
      data: { cells: [], entitySnapshots: version.entitySnapshots },
      isLoading: false,
      error: null,
    };

    const { result } = renderHook(() => useMeasurementMacroPreview(stored));

    expect(result.current).toEqual({ status: "unavailable", blocker: "macro-not-found" });
  });

  it("passes decode-failed through from the stored payload", () => {
    const corrupt: StoredMeasurement = {
      ...stored,
      data: {
        ...stored.data,
        measurementResult: {
          ...payload,
          sample: "!!!not-base64!!!",
          _sample_encoding: "gzip+base64",
        },
      },
    };

    const { result } = renderHook(() => useMeasurementMacroPreview(corrupt));

    expect(result.current).toEqual({ status: "unavailable", blocker: "decode-failed" });
  });

  it("reports no-macro for a questions-only save without fetching anything", () => {
    const questionsOnly: StoredMeasurement = {
      ...stored,
      data: { ...stored.data, measurementResult: { macros: null } },
    };

    const { result } = renderHook(() => useMeasurementMacroPreview(questionsOnly));

    expect(result.current).toEqual({ status: "unavailable", blocker: "no-macro" });
    // Both queries stay disabled: no experiment id to resolve.
    const calls = useQueryMock.mock.calls as [{ __kind: string; enabled?: boolean }][];
    expect(calls.every(([opts]) => opts.enabled === false)).toBe(true);
  });

  it("re-runs against the payload's producing workbook, skipping the experiment lookup", () => {
    // Detach/re-attach can change an experiment's current workbookId; the
    // capture-time workbook_id in the payload is the authoritative one.
    const withRef: StoredMeasurement = {
      ...stored,
      data: {
        ...stored.data,
        measurementResult: { ...payload, workbook_id: "wb-stored" },
      },
    };

    const { result } = renderHook(() => useMeasurementMacroPreview(withRef));

    expect(result.current.status).toBe("ready");
    const calls = useQueryMock.mock.calls as [
      { __kind: string; enabled?: boolean; input?: { id: string } },
    ][];
    const listOpts = calls.find(([o]) => o.__kind === "list")?.[0];
    const versionOpts = calls.find(([o]) => o.__kind === "version")?.[0];
    // The experiment list is never consulted when the payload names its workbook.
    expect(listOpts?.enabled).toBe(false);
    expect(versionOpts?.input?.id).toBe("wb-stored");
  });
});
