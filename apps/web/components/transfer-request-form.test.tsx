import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";

import { TransferRequestForm } from "./transfer-request-form";

globalThis.React = React;

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// -------------------
// Mocks
// -------------------

let savedOnSuccess: (() => void) | undefined;
const mockMutate = vi.fn();
const mockUseTransferRequestCreate = vi.fn();

vi.mock("~/hooks/useTransferRequestCreate/useTransferRequestCreate", () => ({
  useTransferRequestCreate: (options?: { onSuccess?: () => void }) => {
    savedOnSuccess = options?.onSuccess;
    return mockUseTransferRequestCreate(options);
  },
}));

vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// -------------------
// Helpers
// -------------------
function renderTransferRequestForm({
  isPending = false,
  mutate = mockMutate,
}: {
  isPending?: boolean;
  mutate?: typeof mockMutate;
} = {}) {
  mockUseTransferRequestCreate.mockReturnValue({
    mutate,
    isPending,
  });

  return render(<TransferRequestForm />);
}

function triggerSuccess() {
  if (savedOnSuccess) {
    savedOnSuccess();
  }
}

// -------------------
// Tests
// -------------------
describe("<TransferRequestForm />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Form Rendering", () => {
    it("renders all form fields", () => {
      renderTransferRequestForm();

      expect(screen.getByText("transferRequest.projectIdLabel")).toBeInTheDocument();
      expect(screen.getByText("transferRequest.projectUrlLabel")).toBeInTheDocument();
      expect(screen.getByText("transferRequest.consentLabel")).toBeInTheDocument();
    });

    it("renders submit button", () => {
      renderTransferRequestForm();

      expect(screen.getByText("transferRequest.submitButton")).toBeInTheDocument();
    });
  });
});
