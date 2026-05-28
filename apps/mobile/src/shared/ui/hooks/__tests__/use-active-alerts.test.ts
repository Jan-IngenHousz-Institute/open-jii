// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDismissedAlertsStore } from "~/features/measurement-flow/stores/dismissed-alerts-store";
import { useEnvironmentStore } from "~/shared/stores/environment-store";

import { useActiveAlerts } from "../use-active-alerts";

const mockFetchActiveAlerts = vi.fn();

vi.mock("~/features/connection/services/contentful", () => ({
  fetchActiveAlerts: (...args: unknown[]) => mockFetchActiveAlerts(...args),
}));

vi.mock("~/utils/load-env-variables-from-expo", () => ({
  loadEnvVariablesFromExpo: vi.fn().mockReturnValue({}),
}));

const makeAlert = (overrides: Record<string, unknown> = {}) => ({
  sys: { id: "alert-1" },
  internalName: "alert-one",
  title: "Test alert",
  severity: "info",
  type: "info",
  dismissible: true,
  active: true,
  audience: "both",
  startAt: new Date().toISOString(),
  endAt: null,
  ...overrides,
});

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  useEnvironmentStore.setState({ isLoaded: true });
  useDismissedAlertsStore.setState({ dismissedIds: [] });
});

describe("useActiveAlerts", () => {
  it("returns empty array while env is not loaded", () => {
    useEnvironmentStore.setState({ isLoaded: false });
    mockFetchActiveAlerts.mockResolvedValue([makeAlert()]);
    const { result } = renderHook(() => useActiveAlerts(), { wrapper });
    expect(result.current).toEqual([]);
  });

  it("returns alerts once env is loaded and data resolves", async () => {
    mockFetchActiveAlerts.mockResolvedValue([makeAlert()]);
    const { result } = renderHook(() => useActiveAlerts(), { wrapper });
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].title).toBe("Test alert");
  });

  it("filters out dismissed alerts by internalName", async () => {
    useDismissedAlertsStore.setState({ dismissedIds: ["alert-one"] });
    mockFetchActiveAlerts.mockResolvedValue([makeAlert()]);
    const { result } = renderHook(() => useActiveAlerts(), { wrapper });
    await waitFor(() => mockFetchActiveAlerts.mock.calls.length > 0);
    expect(result.current).toHaveLength(0);
  });

  it("falls back to sys.id for dismissal when internalName is null", async () => {
    useDismissedAlertsStore.setState({ dismissedIds: ["alert-1"] });
    mockFetchActiveAlerts.mockResolvedValue([makeAlert({ internalName: null })]);
    const { result } = renderHook(() => useActiveAlerts(), { wrapper });
    await waitFor(() => mockFetchActiveAlerts.mock.calls.length > 0);
    expect(result.current).toHaveLength(0);
  });

  it("sorts by severity: critical first, then warning, then info", async () => {
    mockFetchActiveAlerts.mockResolvedValue([
      makeAlert({ sys: { id: "3" }, internalName: "c", severity: "info" }),
      makeAlert({ sys: { id: "1" }, internalName: "a", severity: "critical" }),
      makeAlert({ sys: { id: "2" }, internalName: "b", severity: "warning" }),
    ]);
    const { result } = renderHook(() => useActiveAlerts(), { wrapper });
    await waitFor(() => expect(result.current).toHaveLength(3));
    expect(result.current.map((a) => a.severity)).toEqual(["critical", "warning", "info"]);
  });

  it("passes locale to fetchActiveAlerts", async () => {
    mockFetchActiveAlerts.mockResolvedValue([]);
    renderHook(() => useActiveAlerts("fr-FR"), { wrapper });
    await waitFor(() => expect(mockFetchActiveAlerts).toHaveBeenCalledWith("fr-FR"));
  });
});
