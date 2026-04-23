import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useUpgradeWorkbookVersion } from "./useUpgradeWorkbookVersion";

const experimentId = "11111111-1111-1111-1111-111111111111";
const workbookId = "22222222-2222-2222-2222-222222222222";
const versionId = "33333333-3333-3333-3333-333333333333";

describe("useUpgradeWorkbookVersion", () => {
  it("calls upgrade endpoint and returns new version info", async () => {
    const spy = server.mount(contract.experiments.upgradeWorkbookVersion, {
      body: { workbookId, workbookVersionId: versionId, version: 2 },
    });

    const { result } = renderHook(() => useUpgradeWorkbookVersion());

    act(() => {
      result.current.mutate({ params: { id: experimentId } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(spy.called).toBe(true);
  });

  it("handles error state", async () => {
    server.mount(contract.experiments.upgradeWorkbookVersion, { status: 500 });

    const { result } = renderHook(() => useUpgradeWorkbookVersion());

    act(() => {
      result.current.mutate({ params: { id: experimentId } });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
