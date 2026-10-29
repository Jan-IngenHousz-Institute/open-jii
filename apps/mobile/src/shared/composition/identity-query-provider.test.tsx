import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { beforeEach, expect, it, vi } from "vitest";
import { useExperimentSelectionStore } from "~/features/experiments/stores/use-experiment-selection-store";
import { useFlowSnapshotsStore } from "~/features/measurement-flow/stores/use-flow-snapshots-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import { IdentityQueryProvider, prepareIdentitySelections } from "./identity-query-provider";

vi.mock("~/features/auth/hooks/use-session", () => ({
  useSession: () => ({ user: null, isLoaded: true }),
}));
vi.mock("~/shared/ui/configured-query-client-provider", () => ({
  ConfiguredQueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
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

it("keeps a researcher's cache and flow through the update that scopes caches by identity", async () => {
  await AsyncStorage.removeItem("openjii_selection_owner");
  await AsyncStorage.setItem("REACT_QUERY_OFFLINE_CACHE_v4", "researcher-offline-cache");
  useMeasurementFlowStore.getState().setExperimentId("field-trial", "Field trial");
  await prepareIdentitySelections("researcher", true);
  expect(await AsyncStorage.getItem("REACT_QUERY_OFFLINE_CACHE_v4:researcher")).toBe(
    "researcher-offline-cache",
  );
  expect(await AsyncStorage.getItem("REACT_QUERY_OFFLINE_CACHE_v4")).toBeNull();
  expect(useMeasurementFlowStore.getState().experimentId).toBe("field-trial");
  expect(await AsyncStorage.getItem("openjii_selection_owner")).toBe("researcher");
});

it("gives the unowned cache to nobody when no researcher is signed in", async () => {
  await AsyncStorage.removeItem("openjii_selection_owner");
  await AsyncStorage.setItem("REACT_QUERY_OFFLINE_CACHE_v4", "someone's cache");
  await prepareIdentitySelections("signed-out");
  expect(await AsyncStorage.getItem("REACT_QUERY_OFFLINE_CACHE_v4")).toBeNull();
  expect(await AsyncStorage.getItem("REACT_QUERY_OFFLINE_CACHE_v4:signed-out")).toBeNull();
});

it("opens on an empty cache when storage keeps failing", async () => {
  vi.useFakeTimers();
  const getItem = vi.mocked(AsyncStorage.getItem);
  const original = getItem.getMockImplementation();
  const ownerReads = () => getItem.mock.calls.filter(([key]) => key === "openjii_selection_owner");
  const before = ownerReads().length;
  try {
    getItem.mockRejectedValue(new Error("disk unavailable"));
    useMeasurementFlowStore.getState().setExperimentId("private-experiment", "Private trial");
    render(
      <IdentityQueryProvider>
        <Text>app</Text>
      </IdentityQueryProvider>,
    );
    expect(screen.queryByText("app")).toBeNull();
    for (let retry = 0; retry < 3; retry++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
    }
    expect(screen.getByText("app")).toBeTruthy();
    expect(useMeasurementFlowStore.getState().experimentId).toBeUndefined();
    expect(ownerReads().length - before).toBe(3);
  } finally {
    if (original) getItem.mockImplementation(original);
    vi.useRealTimers();
  }
});
