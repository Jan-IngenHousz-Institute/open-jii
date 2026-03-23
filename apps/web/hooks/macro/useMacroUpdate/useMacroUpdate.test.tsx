/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useMacroUpdate } from "./useMacroUpdate";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    macros: {
      updateMacro: {
        useMutation: vi.fn(),
      },
    },
  },
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockTsr = tsr;

describe("useMacroUpdate", () => {
  let queryClient: QueryClient;
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    const mockQueryClient = {
      invalidateQueries: mockInvalidateQueries,
      cancelQueries: vi.fn().mockResolvedValue(undefined),
      getQueryData: vi.fn().mockReturnValue(undefined),
      setQueryData: vi.fn(),
    };

    mockTsr.useQueryClient = vi
      .fn()
      .mockReturnValue(mockQueryClient as unknown as ReturnType<typeof tsr.useQueryClient>);
  });

  it("should call useMutation with correct configuration", () => {
    const mockUseMutation = vi.fn();
    (mockTsr.macros.updateMacro.useMutation as unknown) = mockUseMutation;

    renderHook(() => useMacroUpdate("test-macro-id"), {
      wrapper: createWrapper(),
    });

    expect(mockUseMutation).toHaveBeenCalledWith({
      onMutate: expect.any(Function),
      onError: expect.any(Function),
      onSettled: expect.any(Function),
      onSuccess: expect.any(Function),
    });
  });

  it("should return mutation result from useMutation", () => {
    const mockMutationResult = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    };

    (mockTsr.macros.updateMacro.useMutation as unknown) = vi.fn(() => mockMutationResult);

    const { result } = renderHook(() => useMacroUpdate("test-macro-id"), {
      wrapper: createWrapper(),
    });

    expect(result.current).toEqual(mockMutationResult);
  });

  it("should handle successful mutation", async () => {
    let onSettledCallback: (() => Promise<void>) | undefined;

    (mockTsr.macros.updateMacro.useMutation as unknown) = vi.fn(
      ({ onSettled }: { onSettled: () => Promise<void> }) => {
        onSettledCallback = onSettled;
        return {
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isPending: false,
          error: null,
        };
      },
    );

    renderHook(() => useMacroUpdate("test-macro-id"), {
      wrapper: createWrapper(),
    });

    // Simulate settled callback (called after success or error)
    if (onSettledCallback) {
      await onSettledCallback();
    }

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["macro", "test-macro-id"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["macros"],
    });
  });

  it("should return error state from useMutation", () => {
    const mockError = new Error("Update failed");
    const mockMutationResult = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      error: mockError,
    };

    (mockTsr.macros.updateMacro.useMutation as unknown) = vi.fn(() => mockMutationResult);

    const { result } = renderHook(() => useMacroUpdate("test-macro-id"), {
      wrapper: createWrapper(),
    });

    expect(result.current.error).toBe(mockError);
  });

  it("should return loading state from useMutation", () => {
    const mockMutationResult = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: true,
      error: null,
    };

    (mockTsr.macros.updateMacro.useMutation as unknown) = vi.fn(() => mockMutationResult);

    const { result } = renderHook(() => useMacroUpdate("test-macro-id"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);
  });

  it("should handle onMutate callback with optimistic updates", async () => {
    const mockCancelQueries = vi.fn().mockResolvedValue(undefined);
    const mockGetQueryData = vi.fn();
    const mockSetQueryData = vi.fn();
    let onMutateCallback: ((variables: any) => Promise<any>) | undefined;

    const mockQueryClient = {
      invalidateQueries: mockInvalidateQueries,
      cancelQueries: mockCancelQueries,
      getQueryData: mockGetQueryData,
      setQueryData: mockSetQueryData,
    };

    mockTsr.useQueryClient = vi
      .fn()
      .mockReturnValue(mockQueryClient as unknown as ReturnType<typeof tsr.useQueryClient>);

    (mockTsr.macros.updateMacro.useMutation as unknown) = vi.fn(
      ({ onMutate }: { onMutate: (variables: any) => Promise<any> }) => {
        onMutateCallback = onMutate;
        return {
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isPending: false,
          error: null,
        };
      },
    );

    renderHook(() => useMacroUpdate("test-macro-id"), {
      wrapper: createWrapper(),
    });

    const mockVariables = {
      body: { name: "Updated Name", description: "Updated Description" },
    };

    // Simulate onMutate callback
    if (onMutateCallback) {
      await onMutateCallback(mockVariables);
    }

    // Verify cancelQueries was called
    expect(mockCancelQueries).toHaveBeenCalledWith({
      queryKey: ["macro", "test-macro-id"],
    });
    expect(mockCancelQueries).toHaveBeenCalledWith({
      queryKey: ["macros"],
    });

    // Verify getQueryData was called
    expect(mockGetQueryData).toHaveBeenCalledWith(["macro", "test-macro-id"]);
    expect(mockGetQueryData).toHaveBeenCalledWith(["macros"]);
  });

  it("should handle onMutate with existing macro data", async () => {
    const mockCancelQueries = vi.fn().mockResolvedValue(undefined);
    const mockGetQueryData = vi.fn();
    const mockSetQueryData = vi.fn();
    let onMutateCallback: ((variables: any) => Promise<any>) | undefined;

    const existingMacro = {
      body: {
        id: "test-macro-id",
        name: "Original Name",
        description: "Original Description",
        language: "python",
      },
    };

    const existingMacros = {
      body: [
        existingMacro.body,
        { id: "other-macro", name: "Other Macro", description: "Other", language: "r" },
      ],
    };

    mockGetQueryData
      .mockReturnValueOnce(existingMacro) // First call for individual macro
      .mockReturnValueOnce(existingMacros); // Second call for macros list

    const mockQueryClient = {
      invalidateQueries: mockInvalidateQueries,
      cancelQueries: mockCancelQueries,
      getQueryData: mockGetQueryData,
      setQueryData: mockSetQueryData,
    };

    mockTsr.useQueryClient = vi
      .fn()
      .mockReturnValue(mockQueryClient as unknown as ReturnType<typeof tsr.useQueryClient>);

    (mockTsr.macros.updateMacro.useMutation as unknown) = vi.fn(
      ({ onMutate }: { onMutate: (variables: any) => Promise<any> }) => {
        onMutateCallback = onMutate;
        return {
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isPending: false,
          error: null,
        };
      },
    );

    renderHook(() => useMacroUpdate("test-macro-id"), {
      wrapper: createWrapper(),
    });

    const mockVariables = {
      body: { name: "Updated Name", description: "Updated Description" },
    };

    // Simulate onMutate callback
    if (onMutateCallback) {
      await onMutateCallback(mockVariables);
    }

    // Verify optimistic updates were applied
    expect(mockSetQueryData).toHaveBeenCalledWith(["macro", "test-macro-id"], {
      ...existingMacro,
      body: {
        ...existingMacro.body,
        ...mockVariables.body,
      },
    });

    expect(mockSetQueryData).toHaveBeenCalledWith(["macros"], {
      ...existingMacros,
      body: existingMacros.body.map((macro) =>
        macro.id === "test-macro-id" ? { ...macro, ...mockVariables.body } : macro,
      ),
    });
  });

  it("should handle onError callback with rollback", () => {
    const mockSetQueryData = vi.fn();
    let onErrorCallback: ((error: any, variables: any, context: any) => void) | undefined;

    const mockQueryClient = {
      invalidateQueries: mockInvalidateQueries,
      cancelQueries: vi.fn().mockResolvedValue(undefined),
      getQueryData: vi.fn().mockReturnValue(undefined),
      setQueryData: mockSetQueryData,
    };

    mockTsr.useQueryClient = vi
      .fn()
      .mockReturnValue(mockQueryClient as unknown as ReturnType<typeof tsr.useQueryClient>);

    (mockTsr.macros.updateMacro.useMutation as unknown) = vi.fn(
      ({ onError }: { onError: (error: any, variables: any, context: any) => void }) => {
        onErrorCallback = onError;
        return {
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isPending: false,
          error: null,
        };
      },
    );

    renderHook(() => useMacroUpdate("test-macro-id"), {
      wrapper: createWrapper(),
    });

    const mockError = new Error("Update failed");
    const mockVariables = { body: { name: "Failed Update" } };
    const mockContext = {
      previousMacro: { body: { id: "test-macro-id", name: "Original" } },
      previousMacros: { body: [{ id: "test-macro-id", name: "Original" }] },
    };

    // Simulate onError callback
    if (onErrorCallback) {
      onErrorCallback(mockError, mockVariables, mockContext);
    }

    // Verify rollback was performed
    expect(mockSetQueryData).toHaveBeenCalledWith(
      ["macro", "test-macro-id"],
      mockContext.previousMacro,
    );
    expect(mockSetQueryData).toHaveBeenCalledWith(["macros"], mockContext.previousMacros);
  });

  it("should handle onSuccess callback with custom onSuccess prop", () => {
    const mockOnSuccess = vi.fn();
    let onSuccessCallback: ((data: any) => void) | undefined;

    (mockTsr.macros.updateMacro.useMutation as unknown) = vi.fn(
      ({ onSuccess }: { onSuccess: (data: any) => void }) => {
        onSuccessCallback = onSuccess;
        return {
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isPending: false,
          error: null,
        };
      },
    );

    renderHook(() => useMacroUpdate("test-macro-id", { onSuccess: mockOnSuccess }), {
      wrapper: createWrapper(),
    });

    const mockData = {
      body: { id: "test-macro-id", name: "Updated Macro", description: "Updated" },
    };

    // Simulate onSuccess callback
    if (onSuccessCallback) {
      onSuccessCallback(mockData);
    }

    // Verify custom onSuccess was called
    expect(mockOnSuccess).toHaveBeenCalledWith(mockData.body);
  });

  it("should handle onSuccess callback without custom onSuccess prop", () => {
    const mockOnSuccess = vi.fn();
    let onSuccessCallback: ((data: any) => void) | undefined;

    (mockTsr.macros.updateMacro.useMutation as unknown) = vi.fn(
      ({ onSuccess }: { onSuccess: (data: any) => void }) => {
        onSuccessCallback = onSuccess;
        return {
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isPending: false,
          error: null,
        };
      },
    );

    // Call without onSuccess prop
    renderHook(() => useMacroUpdate("test-macro-id"), {
      wrapper: createWrapper(),
    });

    const mockData = {
      body: { id: "test-macro-id", name: "Updated Macro", description: "Updated" },
    };

    // Simulate onSuccess callback
    if (onSuccessCallback) {
      onSuccessCallback(mockData);
    }

    // Verify no error was thrown (coverage for the if condition)
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });
});
