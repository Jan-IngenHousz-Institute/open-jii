/**
 * useTransferRequests hook test — uses MSW to intercept the real HTTP
 * request instead of mocking the `tsr` module. This tests the hook's
 * *observable behaviour* (returned data, loading, error states) rather
 * than its internal wiring to react-query.
 *
 * @see https://testing-library.com/docs/react-testing-library/api#renderhook
 */
import { createTransferRequest, resetFactories } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
import { describe, it, expect, beforeEach } from "vitest";

import { useTransferRequests } from "./useTransferRequests";

describe("useTransferRequests", () => {
  beforeEach(() => {
    resetFactories();
  });

  it("starts in a loading state, then resolves with data", async () => {
    const transferRequests = [
      createTransferRequest({ status: "pending" }),
      createTransferRequest({ status: "completed" }),
    ];

    server.use(
      http.get("http://localhost:3020/api/v1/transfer-requests", () => {
        return HttpResponse.json(transferRequests);
      }),
    );

    const { result } = renderHook(() => useTransferRequests());

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Eventually resolves
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.status).toBe(200);
    expect(result.current.data?.body).toHaveLength(2);
    expect(result.current.data?.body[0]?.status).toBe("pending");
    expect(result.current.data?.body[1]?.status).toBe("completed");
  });

  it("returns an empty list when there are no transfer requests", async () => {
    server.use(
      http.get("http://localhost:3020/api/v1/transfer-requests", () => {
        return HttpResponse.json([]);
      }),
    );

    const { result } = renderHook(() => useTransferRequests());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.body).toEqual([]);
  });

  it("exposes an error when the API returns a server error", async () => {
    server.use(
      http.get("http://localhost:3020/api/v1/transfer-requests", () => {
        return HttpResponse.json({ message: "Internal Server Error" }, { status: 500 });
      }),
    );

    const { result } = renderHook(() => useTransferRequests());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // ts-rest treats non-2xx as an error on the query
    expect(result.current.error).not.toBeNull();
  });
});
