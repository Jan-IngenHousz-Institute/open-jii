import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { ProtocolResultsDisplay } from "./iot-protocol-results-display";

globalThis.React = React;

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Copy: () => <span data-testid="copy-icon">📋</span>,
  Check: () => <span data-testid="check-icon">✓</span>,
  AlertCircle: () => <span data-testid="alert-circle-icon">⚠️</span>,
  CheckCircle2: () => <span data-testid="check-circle-icon">✓</span>,
  Play: () => <span data-testid="play-icon">▶️</span>,
}));

// Mock clipboard API
const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

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
      mockWriteText.mockResolvedValueOnce(undefined);

      render(<ProtocolResultsDisplay testResult={successResult} />);

      // Button contains "common.copy" text from i18n mock
      const copyButton = screen.getByRole("button", { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(JSON.stringify(successResult.data, null, 2));
      });

      vi.useFakeTimers(); // Restore fake timers for other tests
    });

    it("shows check icon after successful copy", async () => {
      vi.useRealTimers(); // Use real timers for this test
      mockWriteText.mockResolvedValueOnce(undefined);

      render(<ProtocolResultsDisplay testResult={successResult} />);

      const copyButton = screen.getByRole("button", { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByTestId("check-icon")).toBeInTheDocument();
      });

      vi.useFakeTimers(); // Restore fake timers for other tests
    });

    it("resets copy icon after 2 seconds", async () => {
      vi.useRealTimers(); // Use real timers for async operations
      mockWriteText.mockResolvedValueOnce(undefined);

      render(<ProtocolResultsDisplay testResult={successResult} />);

      const copyButton = screen.getByRole("button", { name: /copy/i });
      fireEvent.click(copyButton);

      // Wait for check icon to appear
      await waitFor(() => {
        expect(screen.getByTestId("check-icon")).toBeInTheDocument();
      });

      // Wait 2 seconds for the icon to reset
      await new Promise((resolve) => setTimeout(resolve, 2100));

      // Verify copy icon is back
      expect(screen.getByTestId("copy-icon")).toBeInTheDocument();

      vi.useFakeTimers(); // Restore fake timers for other tests
    });

    it("handles copy error gracefully", async () => {
      vi.useRealTimers(); // Use real timers for this test
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // noop
      });
      mockWriteText.mockRejectedValueOnce(new Error("Clipboard error"));

      render(<ProtocolResultsDisplay testResult={successResult} />);

      const copyButton = screen.getByRole("button", { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to copy:", expect.any(Error));
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
