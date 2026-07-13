import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { CommandResultsDisplay } from "./iot-command-results-display";

describe("CommandResultsDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("empty state", () => {
    it("displays empty state when no result", () => {
      render(<CommandResultsDisplay testResult={null} />);

      expect(screen.getByText("iot.commandRunner.noResultsYet")).toBeInTheDocument();
      expect(screen.getByText("iot.commandRunner.runCommandToSeeResults")).toBeInTheDocument();
    });
  });

  describe("success result", () => {
    const successResult = {
      success: true,
      data: { temperature: 25.5, humidity: 60 },
      executionTime: 2340,
      timestamp: new Date("2024-01-15T10:00:00Z"),
    };

    it("displays success badge", () => {
      render(<CommandResultsDisplay testResult={successResult} />);
      expect(screen.getByText("iot.commandRunner.success")).toBeInTheDocument();
    });

    it("displays execution time", () => {
      render(<CommandResultsDisplay testResult={successResult} />);
      expect(screen.getByText(/2340\s*ms/)).toBeInTheDocument();
    });

    it("displays success alert", () => {
      render(<CommandResultsDisplay testResult={successResult} />);
      expect(screen.getByText("iot.commandRunner.passed")).toBeInTheDocument();
    });

    it("displays response data in JSON format", () => {
      render(<CommandResultsDisplay testResult={successResult} />);
      expect(screen.getByText(/"temperature": 25.5/)).toBeInTheDocument();
    });

    it("shows copy button", () => {
      render(<CommandResultsDisplay testResult={successResult} />);
      expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    });
  });

  describe("error result", () => {
    const errorResult = {
      success: false,
      error: "Device timeout - no response from sensor",
      executionTime: 5000,
      timestamp: new Date("2024-01-15T10:00:00Z"),
    };

    it("displays error badge", () => {
      render(<CommandResultsDisplay testResult={errorResult} />);
      expect(screen.getByText("iot.commandRunner.error")).toBeInTheDocument();
    });

    it("displays execution time", () => {
      render(<CommandResultsDisplay testResult={errorResult} />);
      expect(screen.getByText(/5000\s*ms/)).toBeInTheDocument();
    });

    it("displays error alert", () => {
      render(<CommandResultsDisplay testResult={errorResult} />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("displays error message", () => {
      render(<CommandResultsDisplay testResult={errorResult} />);
      expect(screen.getByText("Device timeout - no response from sensor")).toBeInTheDocument();
    });

    it("does not show copy button for error", () => {
      render(<CommandResultsDisplay testResult={errorResult} />);
      expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
    });
  });

  describe("copy functionality", () => {
    const successResult = {
      success: true,
      data: { temperature: 25.5 },
      executionTime: 1000,
      timestamp: new Date(),
    };

    it("copies data to clipboard when copy button is clicked", async () => {
      vi.useRealTimers(); // Use real timers for this test
      const user = userEvent.setup();
      // Spy AFTER userEvent.setup() - it replaces navigator.clipboard
      const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");

      render(<CommandResultsDisplay testResult={successResult} />);

      const copyButton = screen.getByRole("button", { name: /copy/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(writeTextSpy).toHaveBeenCalledWith(JSON.stringify(successResult.data, null, 2));
      });

      vi.useFakeTimers(); // Restore fake timers for other tests
    });

    it("handles copy error gracefully", async () => {
      vi.useRealTimers(); // Use real timers for this test
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });
      const user = userEvent.setup();
      // Spy AFTER userEvent.setup() - it replaces navigator.clipboard
      vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
        new Error("Clipboard error"),
      );

      render(<CommandResultsDisplay testResult={successResult} />);

      const copyButton = screen.getByRole("button", { name: /copy/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to copy to clipboard:",
          expect.any(Error),
        );
      });

      consoleErrorSpy.mockRestore();
      vi.useFakeTimers(); // Restore fake timers for other tests
    });
  });

  describe("data formatting", () => {
    it("formats complex nested data correctly", () => {
      const complexResult = {
        success: true,
        data: {
          measurements: [1, 2, 3],
          metadata: { device: "MultispeQ", version: "2.0" },
        },
        executionTime: 1500,
        timestamp: new Date(),
      };

      render(<CommandResultsDisplay testResult={complexResult} />);

      expect(screen.getByText(/"measurements":/)).toBeInTheDocument();
      expect(screen.getByText(/"metadata":/)).toBeInTheDocument();
    });

    it("handles null data", () => {
      const nullDataResult = {
        success: true,
        data: null,
        executionTime: 1000,
        timestamp: new Date(),
      };

      render(<CommandResultsDisplay testResult={nullDataResult} />);
      expect(screen.getByText("iot.commandRunner.passed")).toBeInTheDocument();
    });

    it("handles undefined data", () => {
      const undefinedDataResult = {
        success: true,
        data: undefined,
        executionTime: 1000,
        timestamp: new Date(),
      };

      render(<CommandResultsDisplay testResult={undefinedDataResult} />);
      expect(screen.getByText("iot.commandRunner.passed")).toBeInTheDocument();
    });
  });
});
