import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { formatJson } from "~/lib/json-format";

import { ProtocolResultsDisplay } from "./iot-protocol-results-display";

describe("ProtocolResultsDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("empty state", () => {
    it("displays empty state when no result", () => {
      render(<ProtocolResultsDisplay testResult={null} />);

      expect(screen.getByText("iot.protocolRunner.noResultsYet")).toBeInTheDocument();
      expect(screen.getByText("iot.protocolRunner.runProtocolToSeeResults")).toBeInTheDocument();
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
      render(<ProtocolResultsDisplay testResult={successResult} />);
      expect(screen.getByText("iot.protocolRunner.success")).toBeInTheDocument();
    });

    it("displays execution time", () => {
      render(<ProtocolResultsDisplay testResult={successResult} />);
      expect(screen.getByText(/2340\s*ms/)).toBeInTheDocument();
    });

    it("displays success alert", () => {
      render(<ProtocolResultsDisplay testResult={successResult} />);
      expect(screen.getByText("iot.protocolRunner.passed")).toBeInTheDocument();
    });

    it("displays response data in JSON format", () => {
      render(<ProtocolResultsDisplay testResult={successResult} />);
      expect(screen.getByText(/"temperature": 25.5/)).toBeInTheDocument();
    });

    it("shows copy button", () => {
      render(<ProtocolResultsDisplay testResult={successResult} />);
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
      render(<ProtocolResultsDisplay testResult={errorResult} />);
      expect(screen.getByText("iot.protocolRunner.error")).toBeInTheDocument();
    });

    it("displays execution time", () => {
      render(<ProtocolResultsDisplay testResult={errorResult} />);
      expect(screen.getByText(/5000\s*ms/)).toBeInTheDocument();
    });

    it("displays error alert", () => {
      render(<ProtocolResultsDisplay testResult={errorResult} />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("displays error message", () => {
      render(<ProtocolResultsDisplay testResult={errorResult} />);
      expect(screen.getByText("Device timeout - no response from sensor")).toBeInTheDocument();
    });

    it("does not show copy button for error", () => {
      render(<ProtocolResultsDisplay testResult={errorResult} />);
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
      // Spy AFTER userEvent.setup(): it replaces navigator.clipboard
      const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");

      render(<ProtocolResultsDisplay testResult={successResult} />);

      const copyButton = screen.getByRole("button", { name: /copy/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(writeTextSpy).toHaveBeenCalledWith(formatJson(successResult.data));
      });

      vi.useFakeTimers(); // Restore fake timers for other tests
    });

    it("switches the response data between the compact and expanded layouts", async () => {
      vi.useRealTimers();
      localStorage.clear();
      const user = userEvent.setup();
      const result = {
        ...successResult,
        data: { samples: Array.from({ length: 40 }, (_, i) => i) },
      };
      render(<ProtocolResultsDisplay testResult={result} />);

      const compact = formatJson(result.data, { style: "compact" });
      const expanded = formatJson(result.data, { style: "expanded" });
      expect(expanded.split("\n").length).toBeGreaterThan(compact.split("\n").length);

      // The rendered text is whitespace-significant, so read the <pre> directly
      // rather than going through getByText, which normalises it.
      const pre = () => document.querySelector("pre")?.textContent;
      expect(pre()).toBe(compact);
      await user.click(screen.getByTestId("json-format-toggle"));
      await waitFor(() => expect(pre()).toBe(expanded));

      vi.useFakeTimers();
    });

    it("handles copy error gracefully", async () => {
      vi.useRealTimers(); // Use real timers for this test
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });
      const user = userEvent.setup();
      // Spy AFTER userEvent.setup(): it replaces navigator.clipboard
      vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
        new Error("Clipboard error"),
      );

      render(<ProtocolResultsDisplay testResult={successResult} />);

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

      render(<ProtocolResultsDisplay testResult={complexResult} />);

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

      render(<ProtocolResultsDisplay testResult={nullDataResult} />);
      expect(screen.getByText("iot.protocolRunner.passed")).toBeInTheDocument();
    });

    it("handles undefined data", () => {
      const undefinedDataResult = {
        success: true,
        data: undefined,
        executionTime: 1000,
        timestamp: new Date(),
      };

      render(<ProtocolResultsDisplay testResult={undefinedDataResult} />);
      expect(screen.getByText("iot.protocolRunner.passed")).toBeInTheDocument();
    });
  });
});
