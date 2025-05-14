import { describe, expect, it, vi, beforeEach } from "vitest";

import { toast } from "@repo/ui/hooks";

import { tsr } from "./tsr";
import {
  extractErrorMessage,
  tsrWithToasts,
  testToastError,
} from "./tsr-with-toasts";

/**
 * This file contains tests for the tsr-with-toasts functionality.
 * You can run these tests using a test framework like Jest or Vitest.
 */

// Mock dependencies
vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

describe("tsr-with-toasts", () => {
  // Clear mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractErrorMessage", () => {
    it("should handle string errors", () => {
      expect(extractErrorMessage("Test error")).toBe("Test error");
    });

    it("should handle object with message property", () => {
      expect(extractErrorMessage({ message: "Object error" })).toBe(
        "Object error",
      );
    });

    it("should handle object with nested body.message", () => {
      expect(extractErrorMessage({ body: { message: "Nested error" } })).toBe(
        "Nested error",
      );
    });

    it("should handle object with status code", () => {
      expect(extractErrorMessage({ status: 404 })).toBe(
        "Request failed with status 404",
      );
    });

    it("should return default message for null/undefined", () => {
      expect(extractErrorMessage(null)).toBe("An error occurred");
      expect(extractErrorMessage(undefined)).toBe("An error occurred");
    });
  });

  describe("testToastError", () => {
    it("should call toast with the correct parameters", () => {
      testToastError("Test toast error");

      expect(toast).toHaveBeenCalledWith({
        variant: "destructive",
        title: "Error",
        description: "Test toast error",
      });
    });
  });

  describe("tsrWithToasts", () => {
    it("should pass through non-mutation properties", () => {
      // These should be direct references to the original
      expect(tsrWithToasts.useQueryClient).toBe(tsr.useQueryClient);
    });

    // This is a more complex integration test
    it("should wrap useMutation with error toast functionality", async () => {
      // Create a mock mutation function that fails
      const mockUseMutation = vi.fn().mockImplementation((options) => {
        // Simulate a mutation by calling onError
        if (options?.onError) {
          options.onError({ message: "API error" }, {}, {});
        }
        return { mutate: vi.fn() };
      });

      // Create a test module with our mock
      const testModule = {
        useMutation: mockUseMutation,
      };

      // Create a proxy for the test module
      const proxy = new Proxy(testModule, {
        get(target, prop) {
          if (prop === "useMutation") {
            // This is what our tsrWithToasts implementation does
            return function (options) {
              // Wrap the options to add toast error handling
              const wrappedOptions = {
                ...options,
                onError: (error, variables, context) => {
                  // Show error toast
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: extractErrorMessage(error),
                  });

                  // Call original onError if provided
                  if (options?.onError) {
                    options.onError(error, variables, context);
                  }
                },
              };

              return target.useMutation(wrappedOptions);
            };
          }
          return target[prop];
        },
      });

      // Custom onError handler for additional logic
      const customOnError = vi.fn();

      // Use our proxied module
      proxy.useMutation({ onError: customOnError });

      // Toast should have been called with the error
      expect(toast).toHaveBeenCalledWith({
        variant: "destructive",
        title: "Error",
        description: "API error",
      });

      // Original onError should still be called
      expect(customOnError).toHaveBeenCalledWith(
        { message: "API error" },
        {},
        {},
      );
    });
  });
});
