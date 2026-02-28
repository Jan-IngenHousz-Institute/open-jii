import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import { ChartPreviewModal } from "./chart-preview-modal";

// Mock the ChartPreview component
vi.mock("./chart-preview", () => ({
  ChartPreview: ({ experimentId }: { form: unknown; experimentId: string }) => (
    <div data-testid="chart-preview">Chart Preview for {experimentId}</div>
  ),
}));

const defaultFormValues = {
  name: "Test Chart",
  description: "Test Description",
  chartType: "line",
  chartFamily: "basic",
  dataConfig: {},
  config: {},
};

function renderPreviewModal(opts: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  experimentId?: string;
}) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <ChartPreviewModal
        form={form}
        experimentId={opts.experimentId ?? "test-experiment-id"}
        isOpen={opts.isOpen}
        onOpenChange={opts.onOpenChange}
      />
    ),
    { useFormProps: { defaultValues: defaultFormValues } },
  );
}

describe("ChartPreviewModal", () => {
  describe("Modal Visibility", () => {
    it("should not render when isOpen is false", () => {
      renderPreviewModal({ isOpen: false, onOpenChange: vi.fn() });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should render when isOpen is true", () => {
      renderPreviewModal({ isOpen: true, onOpenChange: vi.fn() });

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should call onOpenChange with false when dialog is closed", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      renderPreviewModal({ isOpen: true, onOpenChange });

      const closeButton = screen.getByRole("button", { name: /close/i });
      await user.click(closeButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("should call onOpenChange when escape key is pressed", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      renderPreviewModal({ isOpen: true, onOpenChange });

      await user.keyboard("{Escape}");

      expect(onOpenChange).toHaveBeenCalled();
    });
  });

  describe("Modal Content", () => {
    it("should display the preview title and description", () => {
      renderPreviewModal({ isOpen: true, onOpenChange: vi.fn() });

      expect(screen.getByText("preview.title")).toBeInTheDocument();
      expect(screen.getByText("preview.description")).toBeInTheDocument();
    });

    it("should render the Eye icon in the title", () => {
      renderPreviewModal({ isOpen: true, onOpenChange: vi.fn() });

      const title = screen.getByText("preview.title");
      expect(title).toBeInTheDocument();
    });

    it("should render ChartPreview component", () => {
      renderPreviewModal({ isOpen: true, onOpenChange: vi.fn() });

      expect(screen.getByTestId("chart-preview")).toBeInTheDocument();
    });

    it("should pass experimentId to ChartPreview", () => {
      const experimentId = "custom-experiment-id";

      renderPreviewModal({ isOpen: true, onOpenChange: vi.fn(), experimentId });

      expect(screen.getByText(`Chart Preview for ${experimentId}`)).toBeInTheDocument();
    });

    it("should pass form to ChartPreview", () => {
      renderPreviewModal({ isOpen: true, onOpenChange: vi.fn() });

      expect(screen.getByTestId("chart-preview")).toBeInTheDocument();
    });
  });

  describe("Modal Styling", () => {
    it("should have correct dialog content classes", () => {
      renderPreviewModal({ isOpen: true, onOpenChange: vi.fn() });

      const dialogContent = screen.getByRole("dialog");
      expect(dialogContent).toHaveClass("max-w-6xl");

      const chartPreview = screen.getByTestId("chart-preview");
      expect(chartPreview).toBeInTheDocument();
      expect(dialogContent).toContainElement(chartPreview);
    });

    it("should render chart preview container", () => {
      renderPreviewModal({ isOpen: true, onOpenChange: vi.fn() });

      expect(screen.getByTestId("chart-preview")).toBeInTheDocument();
    });
  });

  describe("Modal State Changes", () => {
    it("should show closed state correctly", () => {
      renderPreviewModal({ isOpen: false, onOpenChange: vi.fn() });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should show open state correctly", () => {
      renderPreviewModal({ isOpen: true, onOpenChange: vi.fn() });
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should maintain experiment ID", () => {
      const experimentId = "persistent-experiment-id";

      renderPreviewModal({ isOpen: true, onOpenChange: vi.fn(), experimentId });

      expect(screen.getByText(`Chart Preview for ${experimentId}`)).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper dialog role", () => {
      renderPreviewModal({ isOpen: true, onOpenChange: vi.fn() });

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should have accessible close button", () => {
      renderPreviewModal({ isOpen: true, onOpenChange: vi.fn() });

      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it("should trap focus within modal when open", async () => {
      const user = userEvent.setup();

      renderPreviewModal({ isOpen: true, onOpenChange: vi.fn() });

      const closeButton = screen.getByRole("button", { name: /close/i });

      await user.tab();
      expect(document.activeElement).toBe(closeButton);
    });
  });

  describe("Integration", () => {
    it("should work with different experiment IDs", () => {
      const experimentIds = ["exp-1", "exp-2", "exp-3"];

      experimentIds.forEach((id) => {
        const { unmount } = renderPreviewModal({
          isOpen: true,
          onOpenChange: vi.fn(),
          experimentId: id,
        });

        expect(screen.getByText(`Chart Preview for ${id}`)).toBeInTheDocument();
        unmount();
      });
    });

    it("should cleanup properly when unmounted while open", () => {
      const { unmount } = renderPreviewModal({ isOpen: true, onOpenChange: vi.fn() });

      expect(screen.getByRole("dialog")).toBeInTheDocument();

      expect(() => unmount()).not.toThrow();
    });
  });
});
