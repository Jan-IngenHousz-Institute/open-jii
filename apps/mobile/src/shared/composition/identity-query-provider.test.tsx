import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, expect, it, vi } from "vitest";
import { useExperimentSelectionStore } from "~/features/experiments/stores/use-experiment-selection-store";
import { useFlowSnapshotsStore } from "~/features/measurement-flow/stores/use-flow-snapshots-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import { prepareIdentitySelections } from "./identity-query-provider";

vi.mock("~/features/auth/hooks/use-session", () => ({
  useSession: () => ({ user: null, isLoaded: true }),
}));
vi.mock("~/shared/ui/configured-query-client-provider", () => ({
  ConfiguredQueryClientProvider: () => null,
}));

beforeEach(async () => {
  await AsyncStorage.clear();
});

it.each(["researcher", "guest-a"])(
  "clears %s's persisted private data and selections before guest B",
  async (previous) => {
    await AsyncStorage.setItem("openjii_selection_owner", previous);
    await AsyncStorage.setItem(
      `REACT_QUERY_OFFLINE_CACHE_v4:${previous}`,
      JSON.stringify({ experiment: "private-experiment" }),
    );
    await AsyncStorage.setItem("REACT_QUERY_OFFLINE_CACHE_v4", "legacy-private-data");
    useMeasurementFlowStore.getState().setExperimentId("private-experiment", "Private field trial");
    useFlowSnapshotsStore.getState().setSnapshots("private-workbook", undefined);
    useExperimentSelectionStore.getState().setSelectedExperimentId("private-experiment");
    await prepareIdentitySelections("signed-out");
    await prepareIdentitySelections("guest-b");
    expect(useMeasurementFlowStore.getState().experimentId).toBeUndefined();
    expect(useFlowSnapshotsStore.getState().workbookVersionId).toBeUndefined();
    expect(useExperimentSelectionStore.getState().selectedExperimentId).toBeUndefined();
    expect(await AsyncStorage.getItem(`REACT_QUERY_OFFLINE_CACHE_v4:${previous}`)).toBeNull();
    expect(await AsyncStorage.getItem("REACT_QUERY_OFFLINE_CACHE_v4")).toBeNull();
    await useMeasurementFlowStore.persist.rehydrate();
    await useFlowSnapshotsStore.persist.rehydrate();
    expect(useMeasurementFlowStore.getState().experimentId).toBeUndefined();
    expect(useFlowSnapshotsStore.getState().workbookVersionId).toBeUndefined();
    expect(await AsyncStorage.getItem("openjii_selection_owner")).toBe("guest-b");
  },
);

it("retains the same researcher's offline flow on cold restore", async () => {
  await prepareIdentitySelections("researcher");
  useMeasurementFlowStore.getState().setExperimentId("private-experiment", "Private field trial");
  await prepareIdentitySelections("researcher");
  expect(useMeasurementFlowStore.getState().experimentId).toBe("private-experiment");
});

it("serializes overlapping identity changes and can retry after storage failure", async () => {
  vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error("disk unavailable"));
  await expect(prepareIdentitySelections("guest-a")).rejects.toThrow("disk unavailable");
  await Promise.all([
    prepareIdentitySelections("signed-out"),
    prepareIdentitySelections("guest-b"),
  ]);
  expect(await AsyncStorage.getItem("openjii_selection_owner")).toBe("guest-b");
});
