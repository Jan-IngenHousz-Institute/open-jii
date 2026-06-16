import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
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

const BOB: UserMetadata = {
  userId: "22222222-2222-4222-8222-222222222222",
  firstName: "Bob",
  lastName: "Jones",
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

    it("shows the transferring label and keeps the button disabled while the transfer is in flight", async () => {
      const user = userEvent.setup();
      server.mount(contract.experiments.transferExperimentAdmin, {
        status: 200,
        body: { results: [{ experimentId: ID_1, success: true }] },
        delay: 200,
      });

      renderBlockers({ blockers: [makeBlocker({ id: ID_1, candidates: [ALICE] })] });

      await user.click(screen.getByRole("button", { name: /alice smith/i }));
      await user.click(
        screen.getByRole("button", { name: "dangerZone.delete.blockers.transferAll" }),
      );

      const transferring = await screen.findByRole("button", {
        name: "dangerZone.delete.blockers.transferring",
      });
      expect(transferring).toBeDisabled();
    });
  });

  describe("apply to all", () => {
    // Only candidates present in every blocking experiment are offered as
    // "apply to all" suggestions — Alice is, Bob is not.
    function renderTwoBlockers() {
      return renderBlockers({
        blockers: [
          // Alice is duplicated to exercise candidate de-duplication.
          makeBlocker({ id: ID_1, name: "Climate Study", candidates: [ALICE, BOB, ALICE] }),
          makeBlocker({ id: ID_2, name: "Soil Survey", candidates: [ALICE] }),
        ],
      });
    }

    function getApplyToAllSection() {
      const label = screen.getByText("dangerZone.delete.blockers.applyToAllLabel");
      const section = label.closest("div");
      if (!section) throw new Error("apply-to-all section not found");
      return within(section);
    }

    it("offers only shared candidates and assigns the picked user to every blocker", async () => {
      const user = userEvent.setup();
      renderTwoBlockers();

      const applyToAll = getApplyToAllSection();
      // Bob is missing from the second blocker, so he is not a shared suggestion here.
      expect(applyToAll.queryByRole("button", { name: /bob jones/i })).not.toBeInTheDocument();

      await user.click(applyToAll.getByRole("button", { name: /alice smith/i }));

      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "2/2");
    });

    it("clears every assignment it set when the apply-to-all selection is removed", async () => {
      const user = userEvent.setup();
      renderTwoBlockers();

      const applyToAll = getApplyToAllSection();
      await user.click(applyToAll.getByRole("button", { name: /alice smith/i }));
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "2/2");

      // Clicking the selected (read-only) input clears the apply-to-all choice.
      await user.click(getApplyToAllSection().getByRole("textbox"));

      await waitFor(() =>
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "0/2"),
      );
    });
  });

  describe("platform search", () => {
    it("searches all users and assigns a found user to a blocker", async () => {
      const user = userEvent.setup();
      server.mount(contract.users.searchUsers, {
        status: 200,
        body: [createUserProfile({ userId: BOB.userId, firstName: "Bob", lastName: "Jones" })],
      });

      renderBlockers({ blockers: [makeBlocker({ id: ID_1, candidates: [] })] });

      // No collaborators on this blocker, so the hint shows until a pick is made.
      expect(screen.getByText("dangerZone.delete.blockers.noCandidatesHint")).toBeInTheDocument();

      await user.type(
        screen.getByPlaceholderText("dangerZone.delete.blockers.rowPlaceholder"),
        "bob",
      );

      await user.click(await screen.findByText("Bob Jones"));

      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    });
  });
});
