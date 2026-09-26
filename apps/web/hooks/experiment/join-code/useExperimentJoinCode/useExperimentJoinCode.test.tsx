import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentJoinCode } from "./useExperimentJoinCode";

const EXPERIMENT_ID = "22222222-2222-2222-2222-222222222222";

describe("useExperimentJoinCode", () => {
  it("returns a null join code as a successful read, not an error", async () => {
    server.mount(contract.experiments.getJoinCode, { body: { joinCode: null } });

    const { result } = renderHook(() => useExperimentJoinCode(EXPERIMENT_ID));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.joinCode).toBeNull();
  });

  it("leaves data undefined when the read fails", async () => {
    server.mount(contract.experiments.getJoinCode, { status: 500 });

    const { result } = renderHook(() => useExperimentJoinCode(EXPERIMENT_ID));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("does not fetch when disabled", () => {
    const spy = server.mount(contract.experiments.getJoinCode, { body: { joinCode: null } });

    renderHook(() => useExperimentJoinCode(EXPERIMENT_ID, { enabled: false }));

    expect(spy.called).toBe(false);
  });

  it("does not fetch without an experiment id", () => {
    const spy = server.mount(contract.experiments.getJoinCode, { body: { joinCode: null } });

    renderHook(() => useExperimentJoinCode(""));

    expect(spy.called).toBe(false);
  });
});
