import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { createCalibrationDefinitionDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useUpdateCalibrationDefinition } from "./useUpdateCalibrationDefinition";

const DEFINITION_ID = "22222222-2222-4222-8222-222222222222";

describe("useUpdateCalibrationDefinition", () => {
  it("sends the edit against the definition it was built for", async () => {
    const definition = createCalibrationDefinitionDetail({ id: DEFINITION_ID });
    const update = server.mount(contract.iot.updateCalibrationDefinition, { body: definition });

    const { result } = renderHook(() => useUpdateCalibrationDefinition(DEFINITION_ID));
    result.current.mutate({ definitionId: DEFINITION_ID, name: "Ambit factory bench" });

    await waitFor(() => {
      expect(update.called).toBe(true);
    });
    expect(update.params.definitionId).toBe(DEFINITION_ID);
    expect(update.body).toMatchObject({ name: "Ambit factory bench" });
  });

  // The page autosaves the whole document, so the copy it is editing has to be the copy the
  // server now holds; a stale read would put the author's own save back as someone else's.
  it("refetches the definition it just changed", async () => {
    const definition = createCalibrationDefinitionDetail({ id: DEFINITION_ID });
    const read = server.mount(contract.iot.getCalibrationDefinition, { body: definition });
    server.mount(contract.iot.updateCalibrationDefinition, { body: definition });

    const { result } = renderHook(() => ({
      read: useCalibrationDefinition(DEFINITION_ID),
      update: useUpdateCalibrationDefinition(DEFINITION_ID),
    }));

    await waitFor(() => {
      expect(result.current.read.data?.id).toBe(DEFINITION_ID);
    });
    const before = read.calls.length;

    result.current.update.mutate({ definitionId: DEFINITION_ID, name: "Renamed" });

    await waitFor(() => {
      expect(read.calls.length).toBeGreaterThan(before);
    });
  });

  it("reports a refused edit, so the page can say it is not saving", async () => {
    server.mount(contract.iot.updateCalibrationDefinition, { status: 409 });

    const { result } = renderHook(() => useUpdateCalibrationDefinition(DEFINITION_ID));
    result.current.mutate({ definitionId: DEFINITION_ID, name: "Renamed" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
