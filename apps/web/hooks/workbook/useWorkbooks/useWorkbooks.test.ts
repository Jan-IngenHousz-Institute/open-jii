import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useWorkbooks } from "./useWorkbooks";

describe("useWorkbooks", () => {
  it("returns workbooks from the API with default 'my' filter", async () => {
    const workbooks = [createWorkbook({ id: "wb-1", name: "Mine" })];
    server.mount(contract.workbooks.listWorkbooks, { body: workbooks });

    const { result } = renderHook(() => useWorkbooks());

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].name).toBe("Mine");
    });
    expect(result.current.filter).toBe("my");
  });

  it("shows loading state initially", () => {
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    const { result } = renderHook(() => useWorkbooks());

    expect(result.current.isLoading).toBe(true);
  });

  it("auto-switches to 'all' when user has no workbooks", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    const { result } = renderHook(() => useWorkbooks());

    await waitFor(() => {
      expect(result.current.filter).toBe("all");
    });
  });

  it("provides setFilter to change filter", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: [createWorkbook()] });

    const { result } = renderHook(() => useWorkbooks());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(typeof result.current.setFilter).toBe("function");
    expect(typeof result.current.setSearch).toBe("function");
  });

  it("provides search and setSearch", () => {
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    const { result } = renderHook(() => useWorkbooks());

    expect(result.current.search).toBe("");
    expect(typeof result.current.setSearch).toBe("function");
  });

  it("returns error state on API failure", async () => {
    server.mount(contract.workbooks.listWorkbooks, { status: 400 });

    const { result } = renderHook(() => useWorkbooks());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });
});
