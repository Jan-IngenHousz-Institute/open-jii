import { server } from "@/test/msw/server";
import { render, screen, userEvent } from "@/test/test-utils";
import { waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateUserProfileBody } from "@repo/api";
import { contract } from "@repo/api";
import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks";

import { DangerZoneCard } from "./danger-zone-card";

// We need mock Dialog because real radix Dialog relies on portal/overlay
// which doesn't render content visibly in jsdom without pointer events
vi.mock("@repo/ui/components", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@repo/ui/components");
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
          Close
        </button>
      </div>
    ),
    DialogTrigger: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dialog-trigger">{children}</div>
    ),
    DialogContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dialog-content">{children}</div>
    ),
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

const defaultProfile = { firstName: "Ada", lastName: "Lovelace", activated: true };

function renderCard(props: { profile?: CreateUserProfileBody | null; userId?: string } = {}) {
  return render(
    <DangerZoneCard
      profile={props.profile ?? defaultProfile}
      userId={props.userId ?? "user-123"}
    />,
  );
}

/** Open dialog, type confirmation, return the confirm button */
async function _confirmAction(
  buttonName: string,
  placeholder: string,
  confirmWord: string,
  dialogIndex: number,
) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: buttonName }));
  const input = screen.getByPlaceholderText(placeholder);
  await user.type(input, confirmWord);
  const contents = screen.getAllByTestId("dialog-content");
  // Find the actual confirm button by name within dialog content
  const allBtns = Array.from(contents[dialogIndex].querySelectorAll("button"));
  const btn =
    allBtns.find((b) => !b.disabled && b.textContent.includes("Confirm")) ??
    allBtns.find((b) => !b.disabled && b.textContent !== "dangerZone.cancel");
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return { user, btn: btn!, input };
}

describe("DangerZoneCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders title and both sections", () => {
      renderCard();
      expect(screen.getByText("dangerZone.title")).toBeInTheDocument();
      expect(screen.getByText("dangerZone.deactivate.title")).toBeInTheDocument();
      expect(screen.getByText("dangerZone.delete.title")).toBeInTheDocument();
    });

    it("disables deactivate button when already deactivated", () => {
      renderCard({ profile: { ...defaultProfile, activated: false } });
      expect(
        screen.getByRole("button", { name: "dangerZone.deactivate.buttonDeactivated" }),
      ).toBeDisabled();
    });

    it("enables deactivate button when profile is activated", () => {
      renderCard();
      expect(
        screen.getByRole("button", { name: "dangerZone.deactivate.button" }),
      ).not.toBeDisabled();
    });
  });

  describe("deactivate dialog", () => {
    it("opens dialog with warnings", async () => {
      const user = userEvent.setup();
      renderCard();
      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));
      expect(screen.getByText("dangerZone.deactivate.dialogTitle")).toBeInTheDocument();
      expect(screen.getByText("dangerZone.deactivate.warningTitle")).toBeInTheDocument();
    });

    it("requires confirmation word to enable confirm button", async () => {
      const user = userEvent.setup();
      renderCard();
      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));

      const confirmBtn = screen.getByRole("button", {
        name: "dangerZone.deactivate.buttonConfirm",
      });
      expect(confirmBtn).toBeDisabled();

      const input = screen.getByPlaceholderText("dangerZone.deactivate.confirmPlaceholder");
      await user.type(input, "wrong");
      expect(confirmBtn).toBeDisabled();

      await user.clear(input);
      await user.type(input, "dangerZone.deactivate.confirmWord");
      expect(confirmBtn).not.toBeDisabled();
    });

    it("calls updateProfile with activated: false", async () => {
      const spy = server.mount(contract.users.createUserProfile);
      const user = userEvent.setup();
      const profile = {
        firstName: "Ada",
        lastName: "Lovelace",
        bio: "Mathematician",
        organization: "Royal Society",
        activated: true,
      };
      renderCard({ profile });

      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));
      const input = screen.getByPlaceholderText("dangerZone.deactivate.confirmPlaceholder");
      await user.type(input, "dangerZone.deactivate.confirmWord");

      const confirmBtn = screen.getByRole("button", {
        name: "dangerZone.deactivate.buttonConfirm",
      });
      await user.click(confirmBtn);

      await waitFor(() => expect(spy.called).toBe(true));
      expect(spy.body).toMatchObject({
        ...profile,
        activated: false,
      });
    });

    it("shows success toast and signs out after deactivation", async () => {
      server.mount(contract.users.createUserProfile);
      const user = userEvent.setup();
      renderCard();

      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));
      await user.type(
        screen.getByPlaceholderText("dangerZone.deactivate.confirmPlaceholder"),
        "dangerZone.deactivate.confirmWord",
      );
      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.buttonConfirm" }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith({
          description: "dangerZone.deactivate.successMessage",
        }),
      );
      await waitFor(() => expect(authClient.signOut).toHaveBeenCalled());
    });

    it("shows saving state when pending", async () => {
      server.mount(contract.users.createUserProfile, { delay: 999_999 });
      const user = userEvent.setup();
      renderCard();

      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));
      await user.type(
        screen.getByPlaceholderText("dangerZone.deactivate.confirmPlaceholder"),
        "dangerZone.deactivate.confirmWord",
      );
      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.buttonConfirm" }));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "dangerZone.deactivate.buttonSaving" }),
        ).toBeDisabled(),
      );
    });
  });

  describe("delete dialog", () => {
    it("opens dialog with warnings", async () => {
      const user = userEvent.setup();
      renderCard();
      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));
      expect(screen.getByText("dangerZone.delete.dialogTitle")).toBeInTheDocument();
      expect(screen.getByText("dangerZone.delete.warningEraseTitle")).toBeInTheDocument();
      expect(screen.getByText("dangerZone.delete.warningPreserveTitle")).toBeInTheDocument();
    });

    it("requires confirmation word to enable delete button", async () => {
      const user = userEvent.setup();
      renderCard();
      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));

      const confirmBtn = screen.getByRole("button", {
        name: "dangerZone.delete.buttonConfirm",
      });
      expect(confirmBtn).toBeDisabled();

      const input = screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder");
      await user.type(input, "dangerZone.delete.confirmWord");
      expect(confirmBtn).not.toBeDisabled();
    });

    it("calls deleteAccount with correct userId", async () => {
      const spy = server.mount(contract.users.deleteUser);
      const user = userEvent.setup();
      renderCard({ userId: "user-456" });

      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));
      await user.type(
        screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder"),
        "dangerZone.delete.confirmWord",
      );
      await user.click(screen.getByRole("button", { name: "dangerZone.delete.buttonConfirm" }));

      await waitFor(() => expect(spy.called).toBe(true));
      expect(spy.params).toMatchObject({ id: "user-456" });
    });

    it("shows success toast and signs out after deletion", async () => {
      server.mount(contract.users.deleteUser);
      const user = userEvent.setup();
      renderCard();

      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));
      await user.type(
        screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder"),
        "dangerZone.delete.confirmWord",
      );
      await user.click(screen.getByRole("button", { name: "dangerZone.delete.buttonConfirm" }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith({
          description: "dangerZone.delete.successMessage",
        }),
      );
      await waitFor(() => expect(authClient.signOut).toHaveBeenCalled());
    });

    it("shows destructive toast on deletion error", async () => {
      server.mount(contract.users.deleteUser, {
        status: 403,
        body: { message: "Network error" },
      });
      const user = userEvent.setup();
      renderCard();

      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));
      await user.type(
        screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder"),
        "dangerZone.delete.confirmWord",
      );
      await user.click(screen.getByRole("button", { name: "dangerZone.delete.buttonConfirm" }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith({
          description: "Network error",
          variant: "destructive",
        }),
      );
    });

    it("shows deleting state when pending", async () => {
      server.mount(contract.users.deleteUser, { delay: 999_999 });
      const user = userEvent.setup();
      renderCard();

      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));
      await user.type(
        screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder"),
        "dangerZone.delete.confirmWord",
      );
      await user.click(screen.getByRole("button", { name: "dangerZone.delete.buttonConfirm" }));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "dangerZone.delete.buttonDeleting" }),
        ).toBeDisabled(),
      );
    });
  });

  describe("confirmation input management", () => {
    it("clears deactivate input when dialog reopens", async () => {
      const user = userEvent.setup();
      renderCard();

      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));
      await user.type(
        screen.getByPlaceholderText("dangerZone.deactivate.confirmPlaceholder"),
        "test",
      );
      await user.click(screen.getAllByTestId("dialog-close")[0]);
      await user.click(screen.getByRole("button", { name: "dangerZone.deactivate.button" }));

      expect(screen.getByPlaceholderText("dangerZone.deactivate.confirmPlaceholder")).toHaveValue(
        "",
      );
    });

    it("clears delete input when dialog reopens", async () => {
      const user = userEvent.setup();
      renderCard();

      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));
      await user.type(screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder"), "test");
      await user.click(screen.getAllByTestId("dialog-close")[1]);
      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));

      expect(screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder")).toHaveValue("");
    });
  });
});
