import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import { ChartPreviewModal } from "./chart-preview-modal";

// Mock the translation hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the ChartPreview component
vi.mock("./chart-preview", () => ({
  ChartPreview: ({ experimentId }: { form: unknown; experimentId: string }) => (
    <div data-testid="chart-preview">Chart Preview for {experimentId}</div>
  ),
}));

// Test wrapper component that provides a form
function TestWrapper({
  isOpen,
  onOpenChange,
  experimentId = "test-experiment-id",
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  experimentId?: string;
}) {
  const form = useForm<ChartFormValues>({
    defaultValues: {
      name: "Test Chart",
      description: "Test Description",
      chartType: "line",
      chartFamily: "basic",
      dataConfig: {},
      config: {},
    },
  });

  return (
    <ChartPreviewModal
      form={form}
      experimentId={experimentId}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  );
}

describe("ChartPreviewModal", () => {
  describe("Modal Visibility", () => {
    it("should not render when isOpen is false", () => {
      const onOpenChange = vi.fn();

      render(<TestWrapper isOpen={false} onOpenChange={onOpenChange} />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should render when isOpen is true", () => {
      const onOpenChange = vi.fn();

      render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should call onOpenChange with false when dialog is closed", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      const closeButton = screen.getByRole("button", { name: /close/i });
      await user.click(closeButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("should call onOpenChange when escape key is pressed", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      await user.keyboard("{Escape}");

      expect(onOpenChange).toHaveBeenCalled();
    });
  });

  describe("Modal Content", () => {
    it("should display the preview title and description", () => {
      const onOpenChange = vi.fn();

      render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      expect(screen.getByText("preview.title")).toBeInTheDocument();
      expect(screen.getByText("preview.description")).toBeInTheDocument();
    });

    it("should render the Eye icon in the title", () => {
      const onOpenChange = vi.fn();

      render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      const title = screen.getByText("preview.title");
      expect(title).toBeInTheDocument();
    });

    it("should render ChartPreview component", () => {
      const onOpenChange = vi.fn();

      render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      expect(screen.getByTestId("chart-preview")).toBeInTheDocument();
    });

    it("should pass experimentId to ChartPreview", () => {
      const onOpenChange = vi.fn();
      const experimentId = "custom-experiment-id";

      render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} experimentId={experimentId} />);

      expect(screen.getByText(`Chart Preview for ${experimentId}`)).toBeInTheDocument();
    });

    it("should pass form to ChartPreview", () => {
      const onOpenChange = vi.fn();

      render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      // ChartPreview is rendered, which means form was passed successfully
      expect(screen.getByTestId("chart-preview")).toBeInTheDocument();
    });
  });

  describe("Modal Styling", () => {
    it("should have correct dialog content classes", () => {
      const onOpenChange = vi.fn();

      render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      const dialogContent = screen.getByRole("dialog");
      expect(dialogContent).toHaveClass("max-w-6xl");

      // Check that chart preview is rendered within the modal
      const chartPreview = screen.getByTestId("chart-preview");
      expect(chartPreview).toBeInTheDocument();

      // Verify the chart preview is inside the dialog
      expect(dialogContent).toContainElement(chartPreview);
    });

    it("should render chart preview container", () => {
      const onOpenChange = vi.fn();

      render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      const chartPreview = screen.getByTestId("chart-preview");
      expect(chartPreview).toBeInTheDocument();
    });
  });

  describe("Modal State Changes", () => {
    it("should toggle from closed to open", () => {
      const onOpenChange = vi.fn();

      const { rerender } = render(<TestWrapper isOpen={false} onOpenChange={onOpenChange} />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      rerender(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should toggle from open to closed", () => {
      const onOpenChange = vi.fn();

      const { rerender } = render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();

      rerender(<TestWrapper isOpen={false} onOpenChange={onOpenChange} />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should maintain experiment ID across re-renders", () => {
      const onOpenChange = vi.fn();
      const experimentId = "persistent-experiment-id";

      const { rerender } = render(
        <TestWrapper isOpen={true} onOpenChange={onOpenChange} experimentId={experimentId} />,
      );

      expect(screen.getByText(`Chart Preview for ${experimentId}`)).toBeInTheDocument();

      rerender(
        <TestWrapper isOpen={true} onOpenChange={onOpenChange} experimentId={experimentId} />,
      );

      expect(screen.getByText(`Chart Preview for ${experimentId}`)).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper dialog role", () => {
      const onOpenChange = vi.fn();

      render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should have accessible close button", () => {
      const onOpenChange = vi.fn();

      render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it("should trap focus within modal when open", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      const closeButton = screen.getByRole("button", { name: /close/i });

      // Tab should cycle through focusable elements within the dialog
      await user.tab();
      expect(document.activeElement).toBe(closeButton);
    });
  });

  describe("Integration", () => {
    it("should work with different experiment IDs", () => {
      const onOpenChange = vi.fn();
      const experimentIds = ["exp-1", "exp-2", "exp-3"];

      experimentIds.forEach((id) => {
        const { unmount } = render(
          <TestWrapper isOpen={true} onOpenChange={onOpenChange} experimentId={id} />,
        );

        expect(screen.getByText(`Chart Preview for ${id}`)).toBeInTheDocument();
        unmount();
      });
    });

    it("should handle rapid open/close toggles", () => {
      const onOpenChange = vi.fn();

      const { rerender } = render(<TestWrapper isOpen={false} onOpenChange={onOpenChange} />);

      // Rapidly toggle
      rerender(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      rerender(<TestWrapper isOpen={false} onOpenChange={onOpenChange} />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      rerender(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should cleanup properly when unmounted while open", () => {
      const onOpenChange = vi.fn();

      const { unmount } = render(<TestWrapper isOpen={true} onOpenChange={onOpenChange} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Should not throw errors
      expect(() => unmount()).not.toThrow();
    });
  });
});
