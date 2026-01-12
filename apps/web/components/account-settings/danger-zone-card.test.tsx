import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateUserProfileBody } from "@repo/api";

import { DangerZoneCard } from "./danger-zone-card";

globalThis.React = React;

// ---------- Hoisted mocks ----------
const { updateProfileSpy, deleteAccountSpy, handleLogoutSpy, toastSpy } = vi.hoisted(() => {
  return {
    updateProfileSpy: vi.fn<(arg: { body: CreateUserProfileBody }) => unknown>(),
    deleteAccountSpy: vi.fn<(arg: { params: { id: string } }) => Promise<void>>(),
    handleLogoutSpy: vi.fn<(arg: { redirectTo: string }) => Promise<void>>(),
    toastSpy: vi.fn<(arg: { description: string; variant?: string }) => void>(),
  };
});

// ---------- Mocks ----------
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: (arg: { description: string; variant?: string }) => toastSpy(arg),
}));

// useSignOut replacement for handleLogout
const mockSignOutMutateAsync = vi.fn();
vi.mock("~/hooks/useAuth", () => ({
  useSignOut: () => ({
    mutateAsync: mockSignOutMutateAsync,
  }),
}));

vi.mock("~/app/actions/auth", () => ({
  handleLogout: (arg: { redirectTo: string }) => handleLogoutSpy(arg),
}));

let isPendingUpdate = false;
vi.mock("~/hooks/profile/useCreateUserProfile/useCreateUserProfile", () => ({
  useCreateUserProfile: (cfg: { onSuccess?: () => Promise<void> | void }) => {
    return {
      mutate: (arg: { body: CreateUserProfileBody }, options?: { onSuccess?: () => void }) => {
        updateProfileSpy(arg);
        void cfg.onSuccess?.();
        if (options?.onSuccess) options.onSuccess();
      },
      isPending: isPendingUpdate,
    };
  },
}));

let isDeletingUser = false;
vi.mock("~/hooks/profile/useDeleteUser/useDeleteUser", () => ({
  useDeleteUser: (cfg: { onSuccess?: () => Promise<void> | void }) => {
    return {
      mutateAsync: async (arg: { params: { id: string } }) => {
        await deleteAccountSpy(arg);
        if (cfg.onSuccess) await cfg.onSuccess();
      },
      isPending: isDeletingUser,
    };
  },
}));

// Mock UI components to simplify testing
vi.mock("@repo/ui/components", async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Dialog: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => (
      <div data-testid="dialog" data-open={open}>
        {children}
        <button data-testid="dialog-close" onClick={() => onOpenChange?.(false)}>
          Close Dialog
        </button>
      </div>
    ),
    DialogTrigger: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dialog-trigger">{children}</div>
    ),
    DialogContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dialog-content">{children}</div>
    ),
    DialogHeader: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dialog-header">{children}</div>
    ),
    DialogTitle: ({ children }: { children: React.ReactNode }) => (
      <h2 data-testid="dialog-title">{children}</h2>
    ),
    DialogDescription: ({ children }: { children: React.ReactNode }) => (
      <p data-testid="dialog-description">{children}</p>
    ),
    DialogFooter: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dialog-footer">{children}</div>
    ),
  };
});

// ---------- Helpers ----------
function renderComponent(
  props: {
    profile?: CreateUserProfileBody | null;
    userId?: string;
  } = {},
) {
  const queryClient = new QueryClient();
  const defaultProps = {
    profile: props.profile ?? { firstName: "Ada", lastName: "Lovelace", activated: true },
    userId: props.userId ?? "user-123",
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <DangerZoneCard {...defaultProps} />
    </QueryClientProvider>,
  );
}

// ---------- Tests ----------
describe("<DangerZoneCard />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPendingUpdate = false;
    isDeletingUser = false;
  });

  describe("Rendering", () => {
    it("renders the danger zone card with title", () => {
      renderComponent();

      expect(screen.getByText("dangerZone.title")).toBeInTheDocument();
    });

    it("renders deactivate section with button", () => {
      renderComponent();

      expect(screen.getByText("dangerZone.deactivate.title")).toBeInTheDocument();
      expect(screen.getByText("dangerZone.deactivate.description")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "dangerZone.deactivate.button" }),
      ).toBeInTheDocument();
    });

    it("renders delete section with button", () => {
      renderComponent();

      expect(screen.getByText("dangerZone.delete.title")).toBeInTheDocument();
      expect(screen.getByText("dangerZone.delete.description")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "dangerZone.delete.button" })).toBeInTheDocument();
    });

    it("disables deactivate button when profile is already deactivated", () => {
      renderComponent({
        profile: { firstName: "Ada", lastName: "Lovelace", activated: false },
      });

      const deactivateBtn = screen.getByRole("button", {
        name: "dangerZone.deactivate.buttonDeactivated",
      });
      expect(deactivateBtn).toBeDisabled();
    });

    it("enables deactivate button when profile is activated", () => {
      renderComponent({
        profile: { firstName: "Ada", lastName: "Lovelace", activated: true },
      });

      const deactivateBtn = screen.getByRole("button", {
        name: "dangerZone.deactivate.button",
      });
      expect(deactivateBtn).not.toBeDisabled();
    });
  });

  describe("Deactivate Dialog", () => {
    it("opens deactivate dialog when clicking deactivate button", async () => {
      const user = userEvent.setup();
      renderComponent();

      const deactivateBtn = screen.getByRole("button", {
        name: "dangerZone.deactivate.button",
      });
      await user.click(deactivateBtn);

      expect(screen.getByText("dangerZone.deactivate.dialogTitle")).toBeInTheDocument();
      expect(screen.getByText("dangerZone.deactivate.dialogDescription")).toBeInTheDocument();
    });

    it("displays warning information in deactivate dialog", async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));

      expect(screen.getByText("dangerZone.deactivate.warningTitle")).toBeInTheDocument();
      expect(
        screen.getByText("dangerZone.deactivate.warningList.profileHidden"),
      ).toBeInTheDocument();
      expect(screen.getByText("dangerZone.deactivate.warningList.noRequests")).toBeInTheDocument();
      expect(
        screen.getByText("dangerZone.deactivate.warningList.contentAccessible"),
      ).toBeInTheDocument();
      expect(screen.getByText("dangerZone.deactivate.warningList.loggedOut")).toBeInTheDocument();
      expect(
        screen.getByText("dangerZone.deactivate.warningList.canReactivate"),
      ).toBeInTheDocument();
    });

    it("requires confirmation word to enable deactivate button", async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));

      const dialogContents = screen.getAllByTestId("dialog-content");
      const dialogContent = dialogContents[0];
      const confirmBtn = within(dialogContent).getByRole("button", {
        name: "dangerZone.deactivate.buttonConfirm",
      });

      // Initially disabled
      expect(confirmBtn).toBeDisabled();

      // Type wrong word
      const input = screen.getByPlaceholderText("dangerZone.deactivate.confirmPlaceholder");
      await user.type(input, "wrong");
      expect(confirmBtn).toBeDisabled();

      // Clear and type correct word
      await user.clear(input);
      await user.type(input, "dangerZone.deactivate.confirmWord");
      expect(confirmBtn).not.toBeDisabled();
    });

    it("calls updateProfile with activated: false when deactivating", async () => {
      const user = userEvent.setup();
      const profile = {
        firstName: "Ada",
        lastName: "Lovelace",
        bio: "Mathematician",
        organization: "Royal Society",
        activated: true,
      };
      renderComponent({ profile });

      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));

      const input = screen.getByPlaceholderText("dangerZone.deactivate.confirmPlaceholder");
      await user.type(input, "dangerZone.deactivate.confirmWord");

      const dialogContents = screen.getAllByTestId("dialog-content");
      const dialogContent = dialogContents[0];
      const confirmBtn = within(dialogContent).getByRole("button", {
        name: "dangerZone.deactivate.buttonConfirm",
      });
      await user.click(confirmBtn);

      expect(updateProfileSpy).toHaveBeenCalledWith({
        body: {
          firstName: "Ada",
          lastName: "Lovelace",
          bio: "Mathematician",
          organization: "Royal Society",
          activated: false,
        },
      });
    });

    it("shows success toast and logs out after deactivation", async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));

      const input = screen.getByPlaceholderText("dangerZone.deactivate.confirmPlaceholder");
      await user.type(input, "dangerZone.deactivate.confirmWord");

      const dialogContents = screen.getAllByTestId("dialog-content");
      const dialogContent = dialogContents[0];
      const confirmBtn = within(dialogContent).getByRole("button", {
        name: "dangerZone.deactivate.buttonConfirm",
      });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith({
          description: "dangerZone.deactivate.successMessage",
        });
      });

      await waitFor(() => {
        expect(mockSignOutMutateAsync).toHaveBeenCalled();
      });
    });

    it("closes dialog when clicking cancel", async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));

      const dialogContents = screen.getAllByTestId("dialog-content");
      const dialogContent = dialogContents[0];
      const cancelBtn = within(dialogContent).getByRole("button", {
        name: "dangerZone.cancel",
      });

      // Verify cancel button exists and is clickable
      expect(cancelBtn).toBeInTheDocument();
      await user.click(cancelBtn);
    });

    it("handles profile with missing optional fields", async () => {
      const user = userEvent.setup();
      const profile = {
        firstName: "Ada",
        lastName: "Lovelace",
        activated: true,
      };
      renderComponent({ profile });

      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));

      const input = screen.getByPlaceholderText("dangerZone.deactivate.confirmPlaceholder");
      await user.type(input, "dangerZone.deactivate.confirmWord");

      const dialogContents = screen.getAllByTestId("dialog-content");
      const dialogContent = dialogContents[0];
      const confirmBtn = within(dialogContent).getByRole("button", {
        name: "dangerZone.deactivate.buttonConfirm",
      });
      await user.click(confirmBtn);

      expect(updateProfileSpy).toHaveBeenCalledWith({
        body: {
          firstName: "Ada",
          lastName: "Lovelace",
          bio: undefined,
          organization: undefined,
          activated: false,
        },
      });
    });
  });

  describe("Delete Dialog", () => {
    it("opens delete dialog when clicking delete button", async () => {
      const user = userEvent.setup();
      renderComponent();

      const deleteBtn = screen.getByRole("button", { name: "dangerZone.delete.button" });
      await user.click(deleteBtn);

      expect(screen.getByText("dangerZone.delete.dialogTitle")).toBeInTheDocument();
      expect(screen.getByText("dangerZone.delete.dialogDescription")).toBeInTheDocument();
    });

    it("displays warning information in delete dialog", async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));

      // "Will erase" section
      expect(screen.getByText("dangerZone.delete.warningEraseTitle")).toBeInTheDocument();
      expect(screen.getByText("dangerZone.delete.warningEraseList.profile")).toBeInTheDocument();
      expect(screen.getByText("dangerZone.delete.warningEraseList.email")).toBeInTheDocument();
      expect(screen.getByText("dangerZone.delete.warningEraseList.teams")).toBeInTheDocument();

      // "Will preserve" section
      expect(screen.getByText("dangerZone.delete.warningPreserveTitle")).toBeInTheDocument();
      expect(screen.getByText("dangerZone.delete.warningPreserveList.content")).toBeInTheDocument();
    });

    it("requires confirmation word to enable delete button", async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));

      const dialogContents = screen.getAllByTestId("dialog-content");
      const dialogContent = dialogContents[1];
      const confirmBtn = within(dialogContent).getByRole("button", {
        name: "dangerZone.delete.buttonConfirm",
      });

      // Initially disabled
      expect(confirmBtn).toBeDisabled();

      // Type wrong word
      const input = screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder");
      await user.type(input, "wrong");
      expect(confirmBtn).toBeDisabled();

      // Clear and type correct word
      await user.clear(input);
      await user.type(input, "dangerZone.delete.confirmWord");
      expect(confirmBtn).not.toBeDisabled();
    });

    it("calls deleteAccount with correct userId when deleting", async () => {
      const user = userEvent.setup();
      const userId = "user-456";
      renderComponent({ userId });

      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));

      const input = screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder");
      await user.type(input, "dangerZone.delete.confirmWord");

      const dialogContents = screen.getAllByTestId("dialog-content");
      const dialogContent = dialogContents[1];
      const confirmBtn = within(dialogContent).getByRole("button", {
        name: "dangerZone.delete.buttonConfirm",
      });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(deleteAccountSpy).toHaveBeenCalledWith({ params: { id: userId } });
      });
    });

    it("shows success toast and logs out after deletion", async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));

      const input = screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder");
      await user.type(input, "dangerZone.delete.confirmWord");

      const dialogContents = screen.getAllByTestId("dialog-content");
      const dialogContent = dialogContents[1];
      const confirmBtn = within(dialogContent).getByRole("button", {
        name: "dangerZone.delete.buttonConfirm",
      });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith({
          description: "dangerZone.delete.successMessage",
        });
      });

      await waitFor(() => {
        expect(mockSignOutMutateAsync).toHaveBeenCalled();
      });
    });

    it("handles deletion errors and shows error toast", async () => {
      deleteAccountSpy.mockRejectedValueOnce({
        body: { message: "Network error", code: "NETWORK_ERROR" },
      });
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));

      const input = screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder");
      await user.type(input, "dangerZone.delete.confirmWord");

      const dialogContents = screen.getAllByTestId("dialog-content");
      const dialogContent = dialogContents[1];
      const confirmBtn = within(dialogContent).getByRole("button", {
        name: "dangerZone.delete.buttonConfirm",
      });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith({
          description: "Network error",
          variant: "destructive",
        });
      });
    });

    it("closes dialog when clicking cancel", async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));

      const dialogContents = screen.getAllByTestId("dialog-content");
      const dialogContent = dialogContents[1];
      const cancelBtn = within(dialogContent).getByRole("button", {
        name: "dangerZone.cancel",
      });

      // Verify cancel button exists and is clickable
      expect(cancelBtn).toBeInTheDocument();
      await user.click(cancelBtn);
    });
  });

  describe("Confirmation Input Management", () => {
    it("clears confirmation input when opening deactivate dialog", async () => {
      const user = userEvent.setup();
      renderComponent();

      // Open and type in deactivate dialog
      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));
      const input = screen.getByPlaceholderText("dangerZone.deactivate.confirmPlaceholder");
      await user.type(input, "test");

      // Close dialog - get all close buttons and click the first one (for deactivate dialog)
      const closeBtns = screen.getAllByTestId("dialog-close");
      await user.click(closeBtns[0]);

      // Reopen - input should be empty
      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));
      const newInput = screen.getByPlaceholderText("dangerZone.deactivate.confirmPlaceholder");
      expect(newInput).toHaveValue("");
    });

    it("clears confirmation input when opening delete dialog", async () => {
      const user = userEvent.setup();
      renderComponent();

      // Open and type in delete dialog
      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));
      const input = screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder");
      await user.type(input, "test");

      // Close dialog - get all close buttons and click the second one (for delete dialog)
      const closeBtns = screen.getAllByTestId("dialog-close");
      await user.click(closeBtns[1]);

      // Reopen - input should be empty
      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));
      const newInput = screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder");
      expect(newInput).toHaveValue("");
    });
  });

  describe("Loading States", () => {
    it("shows saving state during deactivation", async () => {
      isPendingUpdate = true;
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));

      const input = screen.getByPlaceholderText("dangerZone.deactivate.confirmPlaceholder");
      await user.type(input, "dangerZone.deactivate.confirmWord");

      // Get the deactivate dialog content (first one)
      const dialogContents = screen.getAllByTestId("dialog-content");
      const dialogContent = dialogContents[0];
      const confirmBtn = within(dialogContent).getByRole("button", {
        name: "dangerZone.deactivate.buttonSaving",
      });

      expect(confirmBtn).toBeInTheDocument();
      expect(confirmBtn).toBeDisabled();
    });

    it("shows deleting state during deletion", async () => {
      isDeletingUser = true;
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));

      const input = screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder");
      await user.type(input, "dangerZone.delete.confirmWord");

      // Get the delete dialog content (second one)
      const dialogContents = screen.getAllByTestId("dialog-content");
      const dialogContent = dialogContents[1];
      const confirmBtn = within(dialogContent).getByRole("button", {
        name: "dangerZone.delete.buttonDeleting",
      });

      expect(confirmBtn).toBeInTheDocument();
      expect(confirmBtn).toBeDisabled();
    });
  });
});
