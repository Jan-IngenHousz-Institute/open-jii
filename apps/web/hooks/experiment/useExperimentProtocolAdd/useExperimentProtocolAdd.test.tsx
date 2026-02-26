/**
 * useExperimentProtocolAdd hook test — MSW-based.
 *
 * The real hook calls `tsr.experiments.addExperimentProtocols.useMutation` →
 * `POST /api/v1/experiments/:id/protocols`. MSW intercepts that request.
 */
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentProtocolAdd } from "./useExperimentProtocolAdd";

describe("useExperimentProtocolAdd", () => {
  it("sends POST request via MSW using addProtocols", async () => {
    const spy = server.mount(contract.experiments.addExperimentProtocols, {
      body: { success: true },
    });

    const { result } = renderHook(() => useExperimentProtocolAdd("exp-1"));

    await act(async () => {
      await result.current.addProtocols([{ protocolId: "proto-1" }]);
    });

    await waitFor(() => {
      expect(spy.called).toBe(true);
      expect(spy.params.id).toBe("exp-1");
    });
  });

  it("sends correct body with auto-assigned order", async () => {
    const spy = server.mount(contract.experiments.addExperimentProtocols, {
      body: { success: true },
    });

    const { result } = renderHook(() => useExperimentProtocolAdd("exp-1"));

    await act(async () => {
      await result.current.addProtocols([{ protocolId: "proto-1" }]);
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({
        protocols: [{ protocolId: "proto-1", order: 0 }],
      });
    });
  });

  it("exposes addProtocols function and mutation state", () => {
    server.mount(contract.experiments.addExperimentProtocols, {
      body: { success: true },
    });

    const { result } = renderHook(() => useExperimentProtocolAdd("exp-1"));

    expect(typeof result.current.addProtocols).toBe("function");
    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("handles error response", async () => {
    server.mount(contract.experiments.addExperimentProtocols, { status: 500 });

    const { result } = renderHook(() => useExperimentProtocolAdd("exp-1"));

    await act(async () => {
      try {
        await result.current.addProtocols([{ protocolId: "proto-1" }]);
      } catch {
        // expected — mutateAsync throws on error
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
