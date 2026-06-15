import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import type { DeletionBlocker, UserMetadata } from "@repo/api/schemas/user.schema";
import { toast } from "@repo/ui/hooks/use-toast";

import { DeleteAccountBlockers } from "./delete-account-blockers";

// The user being deleted — always excluded from transfer candidates.
const CURRENT_USER_ID = "00000000-0000-4000-8000-000000000000";

const ALICE: UserMetadata = {
  userId: "11111111-1111-4111-8111-111111111111",
  firstName: "Alice",
  lastName: "Smith",
  avatarUrl: null,
};

const ID_1 = "aaaaaaaa-0000-4000-8000-000000000001";
const ID_2 = "bbbbbbbb-0000-4000-8000-000000000002";

function makeBlocker(overrides: Partial<DeletionBlocker> = {}): DeletionBlocker {
  return {
    id: ID_1,
    name: "Climate Study",
    status: "active",
    candidates: [],
    ...overrides,
  };
}

function renderBlockers(
  overrides: {
    blockers?: DeletionBlocker[];
    currentUserId?: string;
    locale?: string;
    expanded?: boolean;
    onToggleExpanded?: () => void;
  } = {},
) {
  return render(
    <DeleteAccountBlockers
      blockers={overrides.blockers ?? [makeBlocker()]}
      currentUserId={overrides.currentUserId ?? CURRENT_USER_ID}
      locale={overrides.locale ?? "en-US"}
      expanded={overrides.expanded}
      onToggleExpanded={overrides.onToggleExpanded}
    />,
  );
}

// `useTranslation` is mocked in test setup to echo the key, so assertions use raw keys.
describe("DeleteAccountBlockers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("shows the summary with an empty progress bar and a disabled transfer button", () => {
      renderBlockers({ blockers: [makeBlocker()] });

      expect(screen.getByText("dangerZone.delete.blockers.title")).toBeInTheDocument();
      expect(screen.getByText("dangerZone.delete.blockers.description")).toBeInTheDocument();
      // The "apply to all" picker only appears with more than one blocker.
      expect(
        screen.queryByText("dangerZone.delete.blockers.applyToAllLabel"),
      ).not.toBeInTheDocument();

      const progress = screen.getByRole("progressbar");
      expect(progress).toHaveAttribute("aria-valuemax", "1");
      expect(progress).toHaveAttribute("aria-valuenow", "0");
      expect(progress).toHaveAttribute("aria-valuetext", "0/1");

      expect(
        screen.getByRole("button", { name: "dangerZone.delete.blockers.transferAll" }),
      ).toBeDisabled();
    });

    it("renders a row per blocker with a status and manage link, plus the apply-to-all picker", () => {
      renderBlockers({
        blockers: [
          makeBlocker({ id: ID_1, name: "Climate Study" }),
          makeBlocker({ id: ID_2, name: "Soil Survey" }),
        ],
      });

      expect(screen.getByText("Climate Study")).toBeInTheDocument();
      expect(screen.getByText("Soil Survey")).toBeInTheDocument();
      expect(screen.getAllByText("experiments:status.active")).toHaveLength(2);
      expect(screen.getByText("dangerZone.delete.blockers.applyToAllLabel")).toBeInTheDocument();

      const links = screen.getAllByRole("link", {
        name: "dangerZone.delete.blockers.manageLink",
      });
      expect(links.map((link) => link.getAttribute("href"))).toEqual([
        `/en-US/platform/experiments/${ID_1}/collaborators`,
        `/en-US/platform/experiments/${ID_2}/collaborators`,
      ]);

      const progress = screen.getByRole("progressbar");
      expect(progress).toHaveAttribute("aria-valuemax", "2");
      expect(progress).toHaveAttribute("aria-valuetext", "0/2");
    });
  });

  describe("expand toggle", () => {
    it("renders the expand control and calls onToggleExpanded when clicked", async () => {
      const user = userEvent.setup();
      const onToggleExpanded = vi.fn();
      renderBlockers({ onToggleExpanded });

      await user.click(screen.getByRole("button", { name: "dangerZone.delete.blockers.expand" }));
      expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    });

    it("omits the expand control when onToggleExpanded is not provided", () => {
      renderBlockers();

      expect(
        screen.queryByRole("button", { name: "dangerZone.delete.blockers.expand" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("transferring admin", () => {
    it("selecting a candidate enables the transfer and posts the assignment", async () => {
      const user = userEvent.setup();
      const spy = server.mount(contract.experiments.transferExperimentAdmin, {
        status: 200,
        body: { results: [{ experimentId: ID_1, success: true }] },
      });

      renderBlockers({ blockers: [makeBlocker({ id: ID_1, candidates: [ALICE] })] });

      const transferButton = screen.getByRole("button", {
        name: "dangerZone.delete.blockers.transferAll",
      });
      expect(transferButton).toBeDisabled();

      // Pick the suggested collaborator chip to assign the experiment to. The
      // click flushes its state update, so the selection is reflected at once.
      await user.click(screen.getByRole("button", { name: /alice smith/i }));
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
      expect(transferButton).toBeEnabled();

      await user.click(transferButton);

      // The transfer round-trips through MSW, so wait for the resulting toast.
      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith({
          description: "dangerZone.delete.blockers.transferSuccess",
        }),
      );
      expect(spy.body).toEqual({
        transfers: [{ experimentId: ID_1, targetUserId: ALICE.userId }],
      });
    });

    it("warns when some transfers fail", async () => {
      const user = userEvent.setup();
      server.mount(contract.experiments.transferExperimentAdmin, {
        status: 200,
        body: { results: [{ experimentId: ID_1, success: false, error: "boom" }] },
      });

      renderBlockers({ blockers: [makeBlocker({ id: ID_1, candidates: [ALICE] })] });

      await user.click(screen.getByRole("button", { name: /alice smith/i }));
      await user.click(
        screen.getByRole("button", { name: "dangerZone.delete.blockers.transferAll" }),
      );

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith({
          description: "dangerZone.delete.blockers.transferPartial",
          variant: "destructive",
        }),
      );
    });
  });
});
