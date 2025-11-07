/* eslint-disable @typescript-eslint/no-unsafe-return */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import DataLayout from "../layout";

// Global React for JSX in mocks
globalThis.React = React;

// -------------------
// Mocks
// -------------------

// Mock React's use function for async params
const mockUse = vi.fn();
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    use: (promise: Promise<unknown>) => mockUse(promise),
  };
});

// Mock useExperiment hook
const mockUseExperiment = vi.fn();
vi.mock("@/hooks/experiment/useExperiment/useExperiment", () => ({
  useExperiment: (id: string) => mockUseExperiment(id),
}));

// Mock i18n
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock error display component
vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error, title }: { error: Error; title: string }) => (
    <div data-testid="error-display">
      <h2>{title}</h2>
      <p>{error.message}</p>
    </div>
  ),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => {
  const Alert = ({
    children,
    variant,
    className,
  }: React.PropsWithChildren<{ variant?: string; className?: string }>) => (
    <div data-testid="alert" data-variant={variant} className={className}>
      {children}
    </div>
  );

  const AlertTitle = ({ children }: React.PropsWithChildren) => (
    <h3 data-testid="alert-title">{children}</h3>
  );

  const AlertDescription = ({ children }: React.PropsWithChildren) => (
    <div data-testid="alert-description">{children}</div>
  );

  const TooltipProvider = ({ children }: React.PropsWithChildren) => (
    <div data-testid="tooltip-provider">{children}</div>
  );

  const Tooltip = ({ children }: React.PropsWithChildren) => (
    <div data-testid="tooltip">{children}</div>
  );

  const TooltipTrigger = ({
    children,
    asChild: _asChild,
  }: React.PropsWithChildren<{ asChild?: boolean }>) => {
    return (
      <div data-testid="tooltip-trigger" className="ml-2 inline h-4 w-4 cursor-help">
        {children}
      </div>
    );
  };

  const TooltipContent = ({ children }: React.PropsWithChildren) => (
    <div data-testid="tooltip-content">{children}</div>
  );

  return {
    Alert,
    AlertTitle,
    AlertDescription,
    TooltipProvider,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
  };
});

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  AlertTriangle: (props: React.ComponentProps<"div">) => (
    <div data-testid="alert-triangle-icon" {...props} />
  ),
  Info: (props: React.ComponentProps<"div">) => <div data-testid="info-icon" {...props} />,
  Loader2: (props: React.ComponentProps<"div">) => <div data-testid="loader2-icon" {...props} />,
}));

// -------------------
// Test Data
// -------------------
const mockParams = { id: "test-experiment-id", locale: "en-US" };

const createMockExperiment = (status: string) => ({
  data: {
    body: {
      id: "test-experiment-id",
      name: "Test Experiment",
      status,
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    },
  },
  isLoading: false,
  error: null,
});

// -------------------
// Helpers
// -------------------
function renderDataLayout({
  children = <div data-testid="child-content">Child Content</div>,
  experimentStatus = "active",
  isLoading = false,
  error = null,
}: {
  children?: React.ReactNode;
  experimentStatus?: string;
  isLoading?: boolean;
  error?: Error | null;
} = {}) {
  // Mock the async params
  mockUse.mockReturnValue(mockParams);

  // Mock useExperiment hook response
  if (error) {
    mockUseExperiment.mockReturnValue({
      data: null,
      isLoading: false,
      error,
    });
  } else if (isLoading) {
    mockUseExperiment.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });
  } else {
    mockUseExperiment.mockReturnValue(createMockExperiment(experimentStatus));
  }

  return render(<DataLayout params={Promise.resolve(mockParams)}>{children}</DataLayout>);
}

// -------------------
// Tests
// -------------------
describe("<DataLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("shows loading message when data is loading", () => {
      renderDataLayout({ isLoading: true });

      expect(screen.getByText("loading")).toBeInTheDocument();
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("shows error display when there is an error", () => {
      const error = new Error("Failed to fetch experiment");
      renderDataLayout({ error });

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(screen.getByText("failedToLoad")).toBeInTheDocument();
      expect(screen.getByText("Failed to fetch experiment")).toBeInTheDocument();
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });
  });

  describe("No Data State", () => {
    it("shows not found message when no data is returned", () => {
      mockUse.mockReturnValue(mockParams);
      mockUseExperiment.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      render(
        <DataLayout params={Promise.resolve(mockParams)}>
          <div data-testid="child-content">Child Content</div>
        </DataLayout>,
      );

      expect(screen.getByText("notFound")).toBeInTheDocument();
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });

    it("shows not found message when experiment body is missing", () => {
      mockUse.mockReturnValue(mockParams);
      mockUseExperiment.mockReturnValue({
        data: { body: null },
        isLoading: false,
        error: null,
      });

      render(
        <DataLayout params={Promise.resolve(mockParams)}>
          <div data-testid="child-content">Child Content</div>
        </DataLayout>,
      );

      expect(screen.getByText("notFound")).toBeInTheDocument();
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });
  });

  describe("Active State", () => {
    it("renders children when experiment status is active", () => {
      renderDataLayout({ experimentStatus: "active" });

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(screen.getByText("Child Content")).toBeInTheDocument();
      expect(screen.queryByTestId("alert")).not.toBeInTheDocument();
    });

    it("renders children when experiment status is completed", () => {
      renderDataLayout({ experimentStatus: "completed" });

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(screen.queryByTestId("alert")).not.toBeInTheDocument();
    });

    it("renders children when experiment status is unknown", () => {
      renderDataLayout({ experimentStatus: "unknown" });

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(screen.queryByTestId("alert")).not.toBeInTheDocument();
    });
  });

  describe("Provisioning State", () => {
    it("shows provisioning alert and blocks children when status is provisioning", () => {
      renderDataLayout({ experimentStatus: "provisioning" });

      // Should show alert instead of children
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();

      // Should show the alert with correct styling
      const alert = screen.getByTestId("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute("data-variant", "default");

      // Should show correct title and description
      expect(screen.getByTestId("alert-title")).toHaveTextContent(
        "experimentData.provisioning.title",
      );
      expect(screen.getByTestId("alert-description")).toHaveTextContent(
        "experimentData.provisioning.description",
      );

      // Should show loader icon
      expect(screen.getByTestId("loader2-icon")).toBeInTheDocument();

      // Should show header content
      expect(screen.getByText("experimentData.title")).toBeInTheDocument();
      expect(screen.getByText("experimentData.description")).toBeInTheDocument();
    });

    it("shows tooltip for provisioning state", () => {
      renderDataLayout({ experimentStatus: "provisioning" });

      // Should show tooltip components
      expect(screen.getByTestId("tooltip-provider")).toBeInTheDocument();
      expect(screen.getByTestId("tooltip")).toBeInTheDocument();
      expect(screen.getByTestId("tooltip-trigger")).toBeInTheDocument();
      expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();

      // Should show info icon in tooltip trigger
      expect(screen.getByTestId("info-icon")).toBeInTheDocument();

      // Should show correct tooltip text
      expect(screen.getByText("experimentData.provisioning.tooltip")).toBeInTheDocument();
    });
  });

  describe("Provisioning Failed State", () => {
    it("shows provisioning failed alert and blocks children when status is provisioning_failed", () => {
      renderDataLayout({ experimentStatus: "provisioning_failed" });

      // Should show alert instead of children
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();

      // Should show the alert with correct styling
      const alert = screen.getByTestId("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute("data-variant", "destructive");

      // Should show correct title and description
      expect(screen.getByTestId("alert-title")).toHaveTextContent(
        "experimentData.provisioningFailed.title",
      );
      expect(screen.getByTestId("alert-description")).toHaveTextContent(
        "experimentData.provisioningFailed.description",
      );

      // Should show alert triangle icon
      expect(screen.getByTestId("alert-triangle-icon")).toBeInTheDocument();

      // Should show header content
      expect(screen.getByText("experimentData.title")).toBeInTheDocument();
      expect(screen.getByText("experimentData.description")).toBeInTheDocument();
    });

    it("does not show tooltip for provisioning_failed state", () => {
      renderDataLayout({ experimentStatus: "provisioning_failed" });

      // Should not show tooltip components
      expect(screen.queryByTestId("tooltip-provider")).not.toBeInTheDocument();
      expect(screen.queryByTestId("tooltip")).not.toBeInTheDocument();
      expect(screen.queryByTestId("info-icon")).not.toBeInTheDocument();
    });
  });

  describe("Hook Integration", () => {
    it("calls useExperiment with correct experiment ID", () => {
      renderDataLayout();

      expect(mockUseExperiment).toHaveBeenCalledWith("test-experiment-id");
    });

    it("calls use function with params promise", () => {
      renderDataLayout();

      expect(mockUse).toHaveBeenCalledWith(expect.any(Promise));
    });
  });

  describe("Tooltip Interaction", () => {
    it("only shows tooltip for provisioning state, not for other states", () => {
      // Test provisioning state has tooltip
      const { rerender } = renderDataLayout({ experimentStatus: "provisioning" });
      expect(screen.getByTestId("tooltip-provider")).toBeInTheDocument();

      // Test active state doesn't have tooltip
      mockUseExperiment.mockReturnValue(createMockExperiment("active"));
      rerender(
        <DataLayout params={Promise.resolve(mockParams)}>
          <div data-testid="child-content">Child Content</div>
        </DataLayout>,
      );
      expect(screen.queryByTestId("tooltip-provider")).not.toBeInTheDocument();

      // Test provisioning_failed state doesn't have tooltip
      mockUseExperiment.mockReturnValue(createMockExperiment("provisioning_failed"));
      rerender(
        <DataLayout params={Promise.resolve(mockParams)}>
          <div data-testid="child-content">Child Content</div>
        </DataLayout>,
      );
      expect(screen.queryByTestId("tooltip-provider")).not.toBeInTheDocument();
    });
  });
});
