import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRedeemJoinCode } from "./use-redeem-join-code";

const { mockRedeemJoinCode, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockRedeemJoinCode: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    experiments: {
      listExperiments: { key: () => ["experiments", "list"] },
      getExperimentAccess: { key: () => ["experiments", "access"] },
      resolveJoinCode: { key: () => ["experiments", "join-code"] },
      redeemJoinCode: {
        mutationOptions: (opts: Record<string, unknown>) => ({
          mutationKey: ["experiments", "redeem"],
          mutationFn: (input: unknown) => mockRedeemJoinCode(input),
          ...opts,
        }),
      },
    },
  },
}));

vi.mock("sonner-native", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: { name?: string }) => (vars?.name ? `${key}|${vars.name}` : key),
  }),
}));

let queryClient: QueryClient;
let invalidateSpy: ReturnType<typeof vi.spyOn>;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function invalidatedKeys() {
  return invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey: unknown[] }).queryKey);
}

const ALL_THREE = [
  ["experiments", "list"],
  ["experiments", "access"],
  ["experiments", "join-code"],
];

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  mockRedeemJoinCode.mockResolvedValue({ experimentId: "exp-1", outcome: "joined" });
});

afterEach(() => {
  queryClient.clear();
});

describe("useRedeemJoinCode", () => {
  it("redeems by code", async () => {
    const { result } = renderHook(() => useRedeemJoinCode("Canopy Phi2 Sweep"), { wrapper });

    result.current.redeem({ code: "KP7Q4WMX" });

    await waitFor(() => expect(mockRedeemJoinCode).toHaveBeenCalled());
    expect(mockRedeemJoinCode).toHaveBeenCalledWith({ code: "KP7Q4WMX" });
  });

  it("toasts the joined wording for a first redemption", async () => {
    const { result } = renderHook(() => useRedeemJoinCode("Canopy Phi2 Sweep"), { wrapper });

    result.current.redeem({ code: "KP7Q4WMX" });

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    expect(mockToastSuccess).toHaveBeenCalledWith("experiments:joinCode.joined|Canopy Phi2 Sweep");
  });

  it("toasts the already-in wording for a second scan, which is a success", async () => {
    mockRedeemJoinCode.mockResolvedValue({ experimentId: "exp-1", outcome: "already_member" });

    const { result } = renderHook(() => useRedeemJoinCode("Canopy Phi2 Sweep"), { wrapper });

    result.current.redeem({ code: "KP7Q4WMX" });

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "experiments:joinCode.alreadyMemberToast|Canopy Phi2 Sweep",
    );
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("toasts the server's own copy on error", async () => {
    mockRedeemJoinCode.mockRejectedValue(new Error("This code has expired or was revoked"));

    const { result } = renderHook(() => useRedeemJoinCode("Canopy Phi2 Sweep"), { wrapper });

    result.current.redeem({ code: "KP7Q4WMX" });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastError).toHaveBeenCalledWith("This code has expired or was revoked");
  });

  it("falls back to the generic message when the error carried no copy", async () => {
    mockRedeemJoinCode.mockRejectedValue(new Error(""));

    const { result } = renderHook(() => useRedeemJoinCode("Canopy Phi2 Sweep"), { wrapper });

    result.current.redeem({ code: "KP7Q4WMX" });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockToastError).toHaveBeenCalledWith("common:errorGeneric");
  });

  it("invalidates every experiment listing, access and the preview on success", async () => {
    const { result } = renderHook(() => useRedeemJoinCode("Canopy Phi2 Sweep"), { wrapper });

    result.current.redeem({ code: "KP7Q4WMX" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(3));
    expect(invalidatedKeys()).toEqual(ALL_THREE);
  });

  it("invalidates on error too — a refusal means the cached preview was stale", async () => {
    mockRedeemJoinCode.mockRejectedValue(new Error("This code has expired or was revoked"));

    const { result } = renderHook(() => useRedeemJoinCode("Canopy Phi2 Sweep"), { wrapper });

    result.current.redeem({ code: "KP7Q4WMX" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(3));
    expect(invalidatedKeys()).toEqual(ALL_THREE);
  });
});
