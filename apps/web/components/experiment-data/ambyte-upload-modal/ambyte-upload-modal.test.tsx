import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AmbyteUploadModal } from "./ambyte-upload-modal";

globalThis.React = React;

// Mock the i18n hook
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      // Handle dynamic translations with options
      if (key === "uploadModal.fileUpload.selectedFiles" && options?.count !== undefined) {
        const count = typeof options.count === "number" ? options.count : 0;
        return `${count} files selected`;
      }
      // Return the key as the translation for simplicity
      return key;
    },
  }),
}));

// Mock the upload hook
const mockUploadHook = {
  mutate: vi.fn(),
  isPending: false,
  error: null as Error | null,
  data: null,
  isError: false,
  isSuccess: false,
};

vi.mock("@/hooks/experiment/useExperimentDataUpload/useExperimentDataUpload", () => ({
  useExperimentDataUpload: vi.fn(() => mockUploadHook),
}));

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("AmbyteUploadModal", () => {
  const defaultProps = {
    experimentId: "test-experiment-id",
    open: true,
    onOpenChange: vi.fn(),
    onUploadSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock hook state
    mockUploadHook.mutate = vi.fn();
    mockUploadHook.isPending = false;
    mockUploadHook.error = null;
    mockUploadHook.data = null;
    mockUploadHook.isError = false;
    mockUploadHook.isSuccess = false;
  });

  describe("Initial State", () => {
    it("renders sensor selection step initially", () => {
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText("uploadModal.sensorFamily.label")).toBeInTheDocument();
      expect(screen.getByText("uploadModal.sensorTypes.multispeq.label")).toBeInTheDocument();
      expect(screen.getByText("uploadModal.sensorTypes.ambyte.label")).toBeInTheDocument();
    });

    it("shows MultispeQ as disabled", () => {
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      const multispqOption = screen.getByRole("radio", {
        name: "MultispeQ",
      });
      expect(multispqOption).toBeDisabled();
      expect(screen.getByText("uploadModal.sensorTypes.multispeq.comingSoon")).toBeInTheDocument();
    });

    it("shows Ambyte as enabled", () => {
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      const ambyteOption = screen.getByRole("radio", {
        name: "Ambyte",
      });
      expect(ambyteOption).not.toBeDisabled();
    });
  });

  describe("Sensor Selection", () => {
    it("allows selecting Ambyte sensor", async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);

      // Should proceed to file upload step
      await waitFor(() => {
        expect(screen.getByText("uploadModal.fileUpload.title")).toBeInTheDocument();
      });
    });

    it("does not allow selecting disabled MultispeQ sensor", async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      const multispqRadio = screen.getAllByRole("radio")[0];
      expect(multispqRadio).toBeDisabled();

      // Try clicking the option div
      const multispqOption = screen
        .getByText("uploadModal.sensorTypes.multispeq.label")
        .closest("div");
      if (multispqOption) {
        await user.click(multispqOption);
      }

      // Should still be on sensor selection step
      expect(screen.getByText("uploadModal.sensorFamily.label")).toBeInTheDocument();
    });
  });

  describe("File Upload Step", () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      // Navigate to file upload step
      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);

      await waitFor(() => {
        expect(screen.getByText("uploadModal.fileUpload.title")).toBeInTheDocument();
      });
    });

    it("renders file upload interface", () => {
      expect(screen.getByText("uploadModal.fileUpload.title")).toBeInTheDocument();
      expect(screen.getByText("uploadModal.fileUpload.back")).toBeInTheDocument();
      expect(screen.getByText("uploadModal.fileUpload.uploadFiles")).toBeInTheDocument();
    });

    it("has upload button disabled initially", () => {
      const uploadButton = screen.getByRole("button", {
        name: /uploadModal.fileUpload.uploadFiles/i,
      });
      expect(uploadButton).toBeDisabled();
    });

    it("can go back to sensor selection", async () => {
      const user = userEvent.setup();

      const backButton = screen.getByRole("button", { name: /uploadModal.fileUpload.back/i });
      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByText("uploadModal.sensorFamily.label")).toBeInTheDocument();
      });
    });
  });

  describe("File Upload Interface", () => {
    it("shows file upload interface after sensor selection", async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      // Navigate to file upload step
      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);

      await waitFor(() => {
        expect(screen.getByText("uploadModal.fileUpload.title")).toBeInTheDocument();
        expect(screen.getByText("uploadModal.fileUpload.selectFolder")).toBeInTheDocument();
      });
    });

    it("shows upload button in disabled state initially", async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      // Navigate to file upload step
      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);

      await waitFor(() => {
        const uploadButton = screen.getByRole("button", {
          name: /uploadModal.fileUpload.uploadFiles/i,
        });
        expect(uploadButton).toBeDisabled();
      });
    });
  });

  describe("Navigation", () => {
    it("renders upload interface with correct button states", async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      // Navigate to file upload step
      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);

      await waitFor(() => {
        expect(screen.getByText("uploadModal.fileUpload.title")).toBeInTheDocument();
      });

      // Check that upload button exists and is initially disabled
      const uploadButton = screen.getByRole("button", {
        name: /uploadModal.fileUpload.uploadFiles/i,
      });
      expect(uploadButton).toBeDisabled();

      // Check that back button exists and is enabled
      const backButton = screen.getByRole("button", {
        name: /uploadModal.fileUpload.back/i,
      });
      expect(backButton).not.toBeDisabled();
    });

    it("can navigate back to sensor selection", async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      // Navigate to file upload step
      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);

      await waitFor(() => {
        expect(screen.getByText("uploadModal.fileUpload.title")).toBeInTheDocument();
      });

      // Click back button
      const backButton = screen.getByRole("button", {
        name: /uploadModal.fileUpload.back/i,
      });
      await user.click(backButton);

      // Should be back to sensor selection
      await waitFor(() => {
        expect(screen.getByText("uploadModal.sensorFamily.label")).toBeInTheDocument();
      });
    });
  });

  describe("Modal Controls", () => {
    it("does not render when open is false", () => {
      const { container } = render(<AmbyteUploadModal {...defaultProps} open={false} />, {
        wrapper: createWrapper(),
      });

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("handles upload errors gracefully", () => {
      mockUploadHook.isError = true;
      mockUploadHook.error = new Error("Upload failed");

      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      // The component should handle the error state appropriately
      // This test verifies that errors don't crash the component
      expect(screen.getByText("uploadModal.sensorFamily.label")).toBeInTheDocument();
    });
  });
});
