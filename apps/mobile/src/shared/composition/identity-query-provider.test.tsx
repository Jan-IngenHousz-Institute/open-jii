import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { beforeEach, expect, it, vi } from "vitest";
import { useExperimentSelectionStore } from "~/features/experiments/stores/use-experiment-selection-store";
import { useFlowSnapshotsStore } from "~/features/measurement-flow/stores/use-flow-snapshots-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { shouldPersistQuery } from "~/shared/ui/persist-query-filter";

import { IdentityQueryProvider, prepareIdentitySelections } from "./identity-query-provider";

vi.mock("~/features/auth/hooks/use-session", () => ({
  useSession: () => ({ user: null, isLoaded: true }),
}));
const { cacheFor } = vi.hoisted(() => ({ cacheFor: vi.fn() }));
vi.mock("~/shared/ui/configured-query-client-provider", () => ({
  ConfiguredQueryClientProvider: ({
    identity,
    children,
  }: {
    identity: string;
    children: React.ReactNode;
  }) => {
    cacheFor(identity);
    return children;
  },
}));

// The keys @orpc/tanstack-query gives the old build's persisted profile and experiment list.
const profileKey = (id: string) => [["users", "getUserProfile"], { input: { id }, type: "query" }];
const listExperimentsKey = [
  ["experiments", "listExperiments"],
  { input: { scope: "related" }, type: "query" },
];

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

// The pre-update blob as the old build's persister wrote it, for a profile fetched for `owner`.
function legacyBlob(owner?: string) {
  const client = new QueryClient();
  client.setQueryData(listExperimentsKey, { items: [{ id: "private-experiment" }] });
  if (owner) client.setQueryData(profileKey(owner), { firstName: owner });
  return JSON.stringify({
    buster: "v6-experiments-membership-status",
    timestamp: Date.now(),
    clientState: dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery }),
  });
}

async function upgradeWith(blob: string) {
  await AsyncStorage.removeItem("openjii_selection_owner");
  await AsyncStorage.setItem("REACT_QUERY_OFFLINE_CACHE_v4", blob);
  useMeasurementFlowStore.getState().setExperimentId("field-trial", "Field trial");
}

it("keeps a researcher's own cache and flow through the update that scopes caches by identity", async () => {
  const blob = legacyBlob("researcher-a");
  await upgradeWith(blob);
  await prepareIdentitySelections("researcher-a", true);
  expect(await AsyncStorage.getItem("REACT_QUERY_OFFLINE_CACHE_v4:researcher-a")).toBe(blob);
  expect(await AsyncStorage.getItem("REACT_QUERY_OFFLINE_CACHE_v4")).toBeNull();
  expect(useMeasurementFlowStore.getState().experimentId).toBe("field-trial");
  expect(await AsyncStorage.getItem("openjii_selection_owner")).toBe("researcher-a");
});

it.each([
  ["another researcher's cache", legacyBlob("researcher-a"), "researcher-b", true],
  ["a cache with no profile to name its owner", legacyBlob(), "researcher-b", true],
  ["a researcher's cache, to a guest", legacyBlob("researcher-a"), "guest-b", false],
  ["a researcher's cache, while signed out", legacyBlob("researcher-a"), "signed-out", false],
  ["an unreadable cache", "not json", "researcher-b", true],
] as const)("discards %s and the flow on update", async (_, blob, identity, isResearcher) => {
  await upgradeWith(blob);
  await prepareIdentitySelections(identity, isResearcher);
  expect(await AsyncStorage.getItem("REACT_QUERY_OFFLINE_CACHE_v4")).toBeNull();
  expect(await AsyncStorage.getItem(`REACT_QUERY_OFFLINE_CACHE_v4:${identity}`)).toBeNull();
  expect(useMeasurementFlowStore.getState().experimentId).toBeUndefined();
  expect(await AsyncStorage.getItem("openjii_selection_owner")).toBe(identity);
});

it("stops retrying when storage keeps failing and opens with the identity's own cache", async () => {
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
    expect(cacheFor).toHaveBeenLastCalledWith("signed-out");
  } finally {
    if (original) getItem.mockImplementation(original);
    vi.useRealTimers();
  }
});
