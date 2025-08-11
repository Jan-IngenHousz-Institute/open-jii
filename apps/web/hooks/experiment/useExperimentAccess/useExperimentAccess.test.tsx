import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";

import { useExperimentAccess } from "./useExperimentAccess";

jest.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      getExperimentAccess: {
        useQuery: jest.fn(),
      },
    },
  },
}));

const mockTsr = tsr as jest.Mocked<typeof tsr>;

describe("useExperimentAccess", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries in tests by default
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = jest.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery;

    renderHook(() => useExperimentAccess("experiment-123"), {
      wrapper: createWrapper(),
    });

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: { params: { id: "experiment-123" } },
      queryKey: ["experimentAccess", "experiment-123"],
      retry: expect.any(Function),
    });
  });

  it("should return successful experiment access data", async () => {
    const mockData = {
      status: 200,
      body: {
        experiment: {
          id: "experiment-123",
          name: "Test Experiment",
          visibility: "private",
          status: "active",
        },
        hasAccess: true,
        isAdmin: false,
      },
    };

    const mockUseQuery = jest.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentAccess("experiment-123"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle 404 error for non-existent experiment", async () => {
    const mockError = {
      status: 404,
      message: "Experiment not found",
    };

    const mockUseQuery = jest.fn().mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentAccess("non-existent"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toEqual(mockError);
    expect(result.current.isLoading).toBe(false);
  });

  it("should handle 403 error for unauthorized access", async () => {
    const mockError = {
      status: 403,
      message: "You do not have permission to access this experiment",
    };

    const mockUseQuery = jest.fn().mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentAccess("private-experiment"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toEqual(mockError);
    expect(result.current.isLoading).toBe(false);
  });

  describe("retry logic", () => {
    let retryFunction: (failureCount: number, error: unknown) => boolean;

    beforeEach(() => {
      const mockUseQuery = jest.fn().mockImplementation((options) => {
        retryFunction = options.retry;
        return {
          data: undefined,
          error: null,
          isLoading: true,
        };
      });
      mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery;

      renderHook(() => useExperimentAccess("experiment-123"), {
        wrapper: createWrapper(),
      });
    });

    it("should NOT retry on 403 Forbidden errors", () => {
      const error403 = { status: 403, message: "Forbidden" };

      expect(retryFunction(0, error403)).toBe(false);
      expect(retryFunction(1, error403)).toBe(false);
      expect(retryFunction(2, error403)).toBe(false);
    });

    it("should retry on network errors (up to 3 times)", () => {
      const networkError = { status: 500, message: "Internal Server Error" };

      expect(retryFunction(0, networkError)).toBe(true);
      expect(retryFunction(1, networkError)).toBe(true);
      expect(retryFunction(2, networkError)).toBe(true);
      expect(retryFunction(3, networkError)).toBe(false);
    });

    it("should retry on 404 errors (up to 3 times)", () => {
      const error404 = { status: 404, message: "Not Found" };

      expect(retryFunction(0, error404)).toBe(true);
      expect(retryFunction(1, error404)).toBe(true);
      expect(retryFunction(2, error404)).toBe(true);
      expect(retryFunction(3, error404)).toBe(false);
    });

    it("should retry on timeout/network errors", () => {
      const timeoutError = new Error("Network timeout");

      expect(retryFunction(0, timeoutError)).toBe(true);
      expect(retryFunction(1, timeoutError)).toBe(true);
      expect(retryFunction(2, timeoutError)).toBe(true);
      expect(retryFunction(3, timeoutError)).toBe(false);
    });

    it("should handle edge cases in error object structure", () => {
      // Error without status property
      const errorWithoutStatus = { message: "Some error" };
      expect(retryFunction(0, errorWithoutStatus)).toBe(true);

      // Null error
      expect(retryFunction(0, null)).toBe(true);

      // String error
      expect(retryFunction(0, "String error")).toBe(true);

      // Error object with status but not 403
      const error500 = { status: 500 };
      expect(retryFunction(0, error500)).toBe(true);
    });
  });

  it("should work with public experiments", () => {
    const mockData = {
      status: 200,
      body: {
        experiment: {
          id: "public-experiment",
          name: "Public Experiment",
          visibility: "public",
          status: "active",
        },
        hasAccess: false, // User is not a member
        isAdmin: false,
      },
    };

    const mockUseQuery = jest.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentAccess("public-experiment"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data?.body.experiment.visibility).toBe("public");
    expect(result.current.data?.body.hasAccess).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should work with admin access", () => {
    const mockData = {
      status: 200,
      body: {
        experiment: {
          id: "admin-experiment",
          name: "Admin Experiment",
          visibility: "private",
          status: "active",
        },
        hasAccess: true,
        isAdmin: true,
      },
    };

    const mockUseQuery = jest.fn().mockReturnValue({
      data: mockData,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentAccess("admin-experiment"), {
      wrapper: createWrapper(),
    });

    expect(result.current.data?.body.hasAccess).toBe(true);
    expect(result.current.data?.body.isAdmin).toBe(true);
  });

  it("should handle loading state", () => {
    const mockUseQuery = jest.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentAccess("experiment-123"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("should use different query keys for different experiment IDs", () => {
    const mockUseQuery = jest.fn().mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    });
    mockTsr.experiments.getExperimentAccess.useQuery = mockUseQuery;

    const wrapper = createWrapper();

    renderHook(() => useExperimentAccess("experiment-1"), { wrapper });
    renderHook(() => useExperimentAccess("experiment-2"), { wrapper });

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["experimentAccess", "experiment-1"],
      }),
    );

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["experimentAccess", "experiment-2"],
      }),
    );
  });
});
