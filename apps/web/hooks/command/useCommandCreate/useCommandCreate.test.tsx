import { createCommand } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { useCommandCreate } from "./useCommandCreate";

describe("useCommandCreate", () => {
  it("sends POST request and invokes onSuccess", async () => {
    server.mount(contract.commands.createCommand, {
      body: createCommand({ id: "proto-1" }),
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCommandCreate({ onSuccess }));

    act(() => {
      result.current.mutate({
        body: { name: "Test", code: [{}], family: "multispeq" },
      });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      expect((onSuccess.mock.calls[0][0] as { body: { id: string } }).body.id).toBe("proto-1");
    });
  });

  it("captures request body via spy", async () => {
    const spy = server.mount(contract.commands.createCommand, {
      body: createCommand({ id: "proto-2" }),
    });

    const { result } = renderHook(() => useCommandCreate());

    act(() => {
      result.current.mutate({
        body: { name: "My Command", code: [{ averages: 2 }], family: "multispeq" },
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ name: "My Command" });
    });
  });

  it("does not toast on a successful create", async () => {
    server.mount(contract.commands.createCommand, {
      body: createCommand({ id: "proto-1" }),
    });

    const { result } = renderHook(() => useCommandCreate());

    act(() => {
      result.current.mutate({
        body: { name: "T", code: [{}], family: "multispeq" },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(vi.mocked(toast)).not.toHaveBeenCalled();
  });

  it("shows destructive toast on 409 conflict", async () => {
    server.mount(contract.commands.createCommand, { status: 409 });

    const { result } = renderHook(() => useCommandCreate());

    act(() => {
      result.current.mutate({
        body: { name: "Dup", code: [{}], family: "multispeq" },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(vi.mocked(toast)).toHaveBeenCalledWith({
      description: "commands.nameAlreadyExists",
      variant: "destructive",
    });
  });

  it("shows generic error toast for non-contract errors", async () => {
    server.mount(contract.commands.createCommand, { status: 400 });

    const { result } = renderHook(() => useCommandCreate());

    act(() => {
      result.current.mutate({
        body: { name: "Bad", code: [{}], family: "multispeq" },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(vi.mocked(toast)).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });

  it("calls onError option on failure", async () => {
    server.mount(contract.commands.createCommand, { status: 409 });

    const onError = vi.fn();
    const { result } = renderHook(() => useCommandCreate({ onError }));

    act(() => {
      result.current.mutate({
        body: { name: "Dup", code: [{}], family: "multispeq" },
      });
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });

  it("calls onSettled option after success", async () => {
    server.mount(contract.commands.createCommand, {
      body: createCommand({ id: "proto-1" }),
    });

    const onSettled = vi.fn();
    const { result } = renderHook(() => useCommandCreate({ onSettled }));

    act(() => {
      result.current.mutate({
        body: { name: "T", code: [{}], family: "multispeq" },
      });
    });

    await waitFor(() => {
      expect(onSettled).toHaveBeenCalled();
    });
  });

  it("reverts cache on error", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(["commands"], {
      body: [createCommand({ id: "old" })],
    });

    server.mount(contract.commands.createCommand, { status: 400 });

    const { result } = renderHook(() => useCommandCreate(), { queryClient });

    act(() => {
      result.current.mutate({
        body: { name: "Fail", code: [{}], family: "multispeq" },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    const cached = queryClient.getQueryData<{ body: { id: string }[] }>(["commands"]);
    expect(cached?.body).toHaveLength(1);
    expect(cached?.body[0].id).toBe("old");
  });
});
