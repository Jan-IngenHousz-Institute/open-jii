import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CreateUserProfileBody } from "@repo/api";
import { contract } from "@repo/api";
import { authClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks";

import { DangerZoneCard } from "./danger-zone-card";

const defaultProfile = { firstName: "Ada", lastName: "Lovelace", activated: true };

function renderCard(props: { profile?: CreateUserProfileBody | null; userId?: string } = {}) {
  return render(
    <DangerZoneCard
      profile={props.profile ?? defaultProfile}
      userId={props.userId ?? "user-123"}
    />,
  );
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
      await user.click(screen.getByRole("button", { name: "dangerZone.cancel" }));
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
      await user.click(screen.getByRole("button", { name: "dangerZone.cancel" }));
      await user.click(screen.getByRole("button", { name: "dangerZone.delete.button" }));

      expect(screen.getByPlaceholderText("dangerZone.delete.confirmPlaceholder")).toHaveValue("");
    });
  });
});
