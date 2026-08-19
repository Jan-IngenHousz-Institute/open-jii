import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "~/features/recent-measurements/services/measurement-list-cache";

import { AppBootstrap } from "./app-bootstrap";

const mockBackfill = vi.fn<() => Promise<number>>();

vi.mock("~/shared/db/measurements-backfill", () => ({
  backfillDerivedColumns: () => mockBackfill(),
}));

// The boot wiring collaborators are covered by their own suites; here they
// only need to mount and unmount without side effects.
vi.mock("~/features/recent-measurements/services/outbox-to-query-cache-bridge", () => ({
  mountOutboxBridge: () => () => undefined,
}));
vi.mock("~/features/connection/services/connection-lifecycle", () => ({
  mountConnectionLifecycle: () => () => undefined,
}));
vi.mock("~/features/measurement-flow/stores/flow-rehydration-guard", () => ({
  installFlowRehydrationGuard: () => () => undefined,
}));
// Side-effect module wires the real auth client; irrelevant here.
vi.mock("~/shared/composition/auth-wiring", () => ({}));

function renderBootstrap(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AppBootstrap />
      <Text>app</Text>
    </QueryClientProvider>,
  );
}

describe("AppBootstrap backfill wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates the measurement query root when the backfill updated rows", async () => {
    mockBackfill.mockResolvedValue(3);
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderBootstrap(queryClient);

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.root }));
  });

  it("does not invalidate when the backfill had nothing to do", async () => {
    mockBackfill.mockResolvedValue(0);
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderBootstrap(queryClient);

    await waitFor(() => expect(mockBackfill).toHaveBeenCalled());
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("logs and carries on when the backfill fails", async () => {
    mockBackfill.mockRejectedValue(new Error("db locked"));
    const queryClient = new QueryClient();

    renderBootstrap(queryClient);

    await waitFor(() => expect(mockBackfill).toHaveBeenCalled());
    expect(screen.getByText("app")).toBeTruthy();
  });
});
