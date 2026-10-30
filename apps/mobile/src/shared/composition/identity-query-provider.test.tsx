import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react-native";
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
const workbookVersionKey = [
  ["workbooks", "getWorkbookVersion"],
  { input: { id: "w-b", versionId: "v-1" }, type: "query" },
];
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

// The pre-update blob as the old build's persister wrote it.
function legacyBlob(entries: [readonly unknown[], unknown][]) {
  const client = new QueryClient();
  for (const [key, data] of entries) client.setQueryData(key, data);
  return JSON.stringify({
    buster: "v6-experiments-membership-status",
    timestamp: Date.now(),
    clientState: dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery }),
  });
}

async function upgradeWith(blob: string, flowExperiment: string) {
  await AsyncStorage.removeItem("openjii_selection_owner");
  await AsyncStorage.setItem("REACT_QUERY_OFFLINE_CACHE_v4", blob);
  useMeasurementFlowStore.getState().setExperimentId(flowExperiment, "Field trial");
}

it.each([
  [
    "a researcher's profile beside another person's private workbook",
    legacyBlob([
      [profileKey("researcher-a"), { firstName: "A" }],
      [workbookVersionKey, { cells: ["researcher-b's private cell"] }],
    ]),
    "researcher-a",
  ],
  [
    "the researcher's own profile under another person's unfinished flow",
    legacyBlob([[profileKey("researcher-a"), { firstName: "A" }]]),
    "researcher-a",
  ],
  ["another researcher's cache", legacyBlob([[profileKey("researcher-a"), {}]]), "researcher-b"],
  ["a cache, to a guest", legacyBlob([[listExperimentsKey, { items: [] }]]), "guest-b"],
  ["a cache, while signed out", legacyBlob([[listExperimentsKey, { items: [] }]]), "signed-out"],
  ["an unreadable cache", "not json", "researcher-b"],
] as const)(
  "discards %s with its flow, since no old build recorded an owner",
  async (_, blob, identity) => {
    await upgradeWith(blob, "researcher-b-private-trial");
    await prepareIdentitySelections(identity);
    expect(await AsyncStorage.getItem("REACT_QUERY_OFFLINE_CACHE_v4")).toBeNull();
    expect(await AsyncStorage.getItem(`REACT_QUERY_OFFLINE_CACHE_v4:${identity}`)).toBeNull();
    expect(useMeasurementFlowStore.getState().experimentId).toBeUndefined();
    expect(await AsyncStorage.getItem("openjii_selection_owner")).toBe(identity);
  },
);

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

it("opens the identity-scoped provider after its selection storage succeeds", async () => {
  render(
    <IdentityQueryProvider>
      <Text>ready app</Text>
    </IdentityQueryProvider>,
  );
  await waitFor(() => expect(screen.getByText("ready app")).toBeTruthy());
  expect(cacheFor).toHaveBeenLastCalledWith("signed-out");
});
