import {
  createCapabilities,
  createExperimentAccess,
  createInvitation,
  createResourceGrant,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import {
  createTestQueryClient,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test/test-utils";
import { use } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { Experiment, ExperimentAccess } from "@repo/api/domains/experiment/experiment.schema";
import { useSession } from "@repo/auth/client";

import ExperimentCollaboratorsPage from "./experiment-collaborators-content";

const experimentId = "exp-123";

const props = { params: Promise.resolve({ locale: "en-US", id: experimentId }) };

const element = () => <ExperimentCollaboratorsPage {...props} />;

function renderPage() {
  return render(element());
}

/** Point the globally-mocked `useSession` at a given principal. */
function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

type AccessOverrides = Omit<Partial<ExperimentAccess>, "experiment"> & {
  experiment?: Partial<Experiment>;
};

function accessPayload({ experiment, ...overrides }: AccessOverrides = {}): ExperimentAccess {
  return createExperimentAccess({
    experiment: { id: experimentId, name: "Test Experiment", status: "active", ...experiment },
    isAdmin: true,
    capabilities: {
      canContribute: true,
      canUpdate: true,
      canManage: true,
      canShare: true,
      canLeave: false,
    },
    ...overrides,
  });
}

/** The tab strip, so triggers can be counted without matching panel content. */
function tabStrips(): HTMLElement[] {
  return screen.getAllByRole("tablist");
}

/** A pending-invitation row, so its per-row tier can be read unambiguously. */
function invitationRowFor(email: string): HTMLElement {
  const row = screen.getByText(email).closest('[role="listitem"]');
  if (!row) throw new Error(`No invitation row found for ${email}`);
  return row as HTMLElement;
}

describe("ExperimentCollaboratorsPage", () => {
  beforeEach(() => {
    // The page reads its route params with `use()`, which would otherwise suspend
    // in a test tree that has no boundary.
    vi.mocked(use).mockReturnValue({ locale: "en-US", id: experimentId });
    mockSession({ id: "user-1" });
    server.mount(contract.experiments.listJoinRequests, { body: [] });
    server.mount(contract.users.listInvitations, { body: [] });
    server.mount(contract.sharing.listGrants, { body: [] });
  });

  describe("layout", () => {
    it("renders one tab strip of Collaborators / Invited / Requests and no second sharing surface", async () => {
      server.mount(contract.experiments.getExperimentAccess, { body: accessPayload() });

      renderPage();

      await waitFor(() =>
        expect(screen.getByText("experimentSettings.collaborators")).toBeInTheDocument(),
      );

      // Exactly one strip — not a strip plus a stacked sharing card of its own.
      expect(tabStrips()).toHaveLength(1);
      const tabs = within(tabStrips()[0]).getAllByRole("tab");
      expect(tabs.map((tab) => tab.textContent)).toEqual([
        expect.stringContaining("experimentSettings.collaboratorsTab"),
        expect.stringContaining("experimentSettings.invitedTab"),
        expect.stringContaining("experimentSettings.requestsTab"),
      ]);

      // The dissolved card's own headings are gone for good.
      expect(screen.queryByText("sharing.cardTitle")).not.toBeInTheDocument();
      expect(screen.queryByText("sharing.experimentCardTitle")).not.toBeInTheDocument();
    });

    it("defaults to the Collaborators tab", async () => {
      server.mount(contract.sharing.listGrants, {
        body: [
          createResourceGrant({
            resourceType: "experiment",
            resourceId: experimentId,
            grantee: {
              type: "user",
              displayName: "Lin Zhao",
              email: "lin@uni.edu",
              avatarUrl: null,
            },
          }),
        ],
      });
      server.mount(contract.experiments.getExperimentAccess, { body: accessPayload() });

      renderPage();

      await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
      expect(
        within(tabStrips()[0]).getByRole("tab", {
          name: /experimentSettings.collaboratorsTab/,
        }),
      ).toHaveAttribute("data-state", "active");
    });

    it("keeps the only user search behind the invite modal", async () => {
      const user = userEvent.setup();
      server.mount(contract.experiments.getExperimentAccess, { body: accessPayload() });

      renderPage();

      await waitFor(() =>
        expect(screen.getByText("experimentSettings.collaborators")).toBeInTheDocument(),
      );

      // The page's own input filters the lists; it never searches for people.
      expect(
        screen.getByPlaceholderText("experimentSettings.filterCollaboratorsPlaceholder"),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("sharing.granteeSearchLabel")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /experimentSettings.invite/ }));

      expect(screen.getByLabelText("sharing.granteeSearchLabel")).toBeInTheDocument();
      expect(screen.getByLabelText("sharing.newShareRoleLabel")).toBeInTheDocument();
    });

    it("shows each pending invitation's tier on the Invited tab", async () => {
      const user = userEvent.setup();
      server.mount(contract.users.listInvitations, {
        body: [
          createInvitation({ id: "inv-1", email: "viewer@uni.edu", tier: "viewer" }),
          createInvitation({ id: "inv-2", email: "editor@uni.edu", tier: "admin" }),
        ],
      });
      server.mount(contract.experiments.getExperimentAccess, { body: accessPayload() });

      renderPage();

      await waitFor(() =>
        expect(screen.getByText("experimentSettings.collaborators")).toBeInTheDocument(),
      );
      await user.click(
        within(tabStrips()[0]).getByRole("tab", { name: /experimentSettings.invitedTab/ }),
      );

      // The tier an invitee lands on is legible before they accept, not just after.
      expect(
        within(invitationRowFor("viewer@uni.edu")).getByText("sharing.roleCanView"),
      ).toBeInTheDocument();
      expect(
        within(invitationRowFor("editor@uni.edu")).getByText("sharing.roleCanEdit"),
      ).toBeInTheDocument();
    });

    it("filters the grant rows with the page filter", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.listGrants, {
        body: [
          createResourceGrant({
            id: "g-1",
            grantee: {
              type: "user",
              displayName: "Lin Zhao",
              email: "lin@uni.edu",
              avatarUrl: null,
            },
          }),
          createResourceGrant({
            id: "g-2",
            grantee: {
              type: "user",
              displayName: "Asha Okafor",
              email: "asha@greenhouse.lab",
              avatarUrl: null,
            },
          }),
        ],
      });
      server.mount(contract.experiments.getExperimentAccess, { body: accessPayload() });

      renderPage();

      await waitFor(() => expect(screen.getByText("Asha Okafor")).toBeInTheDocument());

      await user.type(
        screen.getByPlaceholderText("experimentSettings.filterCollaboratorsPlaceholder"),
        "greenhouse",
      );

      await waitFor(() => expect(screen.queryByText("Lin Zhao")).not.toBeInTheDocument());
      expect(screen.getByText("Asha Okafor")).toBeInTheDocument();
    });
  });

  describe("share gate", () => {
    it("hides the collaborators and invited tabs — and fetches neither — without can(share)", async () => {
      const listSpy = server.mount(contract.sharing.listGrants, { body: [] });
      const invitationsSpy = server.mount(contract.users.listInvitations, { body: [] });
      server.mount(contract.experiments.getExperimentAccess, {
        body: accessPayload({
          capabilities: {
            canContribute: true,
            canUpdate: true,
            canManage: true,
            canShare: false,
            canLeave: false,
          },
        }),
      });

      renderPage();

      await waitFor(() =>
        expect(screen.getByText("experimentSettings.collaborators")).toBeInTheDocument(),
      );

      const tabs = within(tabStrips()[0]).getAllByRole("tab");
      expect(tabs).toHaveLength(1);
      expect(tabs[0]).toHaveTextContent("experimentSettings.requestsTab");

      // Neither share-gated request is spent on a caller the capability signal
      // already rules out.
      expect(listSpy.called).toBe(false);
      expect(invitationsSpy.called).toBe(false);
    });

    it("offers a viewer grantee the leave card — their only way out, since they have no row", async () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: accessPayload({
          isAdmin: false,
          capabilities: {
            canContribute: true,
            canUpdate: false,
            canManage: false,
            canShare: false,
            canLeave: true,
          },
        }),
      });

      renderPage();

      await waitFor(() => expect(screen.getByText("sharing.yourAccessTitle")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: /sharing.leaveAction/ })).toBeInTheDocument();
    });

    it("shows no leave card to share-capable users (they leave via their own row) or to org readers", async () => {
      // Share-capable: canLeave true but the row-based leave applies.
      server.mount(contract.experiments.getExperimentAccess, {
        body: accessPayload({ capabilities: createCapabilities({ canLeave: true }) }),
      });
      const { unmount } = renderPage();
      await waitFor(() =>
        expect(screen.getByText("experimentSettings.collaborators")).toBeInTheDocument(),
      );
      expect(screen.queryByText("sharing.yourAccessTitle")).not.toBeInTheDocument();
      unmount();

      // Org reader: nothing of their own to give up, no card.
      server.mount(contract.experiments.getExperimentAccess, {
        body: accessPayload({
          isAdmin: false,
          capabilities: {
            canContribute: false,
            canUpdate: false,
            canManage: false,
            canShare: false,
            canLeave: false,
          },
        }),
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByText("experimentSettings.collaborators")).toBeInTheDocument(),
      );
      expect(screen.queryByText("sharing.yourAccessTitle")).not.toBeInTheDocument();
    });

    it("never serves one user's share-gated data to the next user on the same client", async () => {
      // One QueryClient across both sessions, like the app's module-level client
      // surviving a client-side sign-out → sign-in on the same URL.
      const queryClient = createTestQueryClient();

      mockSession({ id: "user-a" });
      server.mount(contract.experiments.getExperimentAccess, { body: accessPayload() });
      server.mount(contract.users.listInvitations, {
        body: [createInvitation({ email: "invitee-of-a@uni.edu" })],
      });
      server.mount(contract.sharing.listGrants, {
        body: [
          createResourceGrant({
            grantee: {
              type: "user",
              displayName: "Asha Okafor",
              email: "asha@greenhouse.lab",
              avatarUrl: null,
            },
          }),
        ],
      });

      // A fresh element each time: React bails out of re-rendering an identical
      // element object, which would mask the session switch.
      const { rerender } = render(element(), { queryClient });

      await waitFor(() => expect(screen.getByText("Asha Okafor")).toBeInTheDocument());
      await userEvent
        .setup()
        .click(within(tabStrips()[0]).getByRole("tab", { name: /experimentSettings.invitedTab/ }));
      await waitFor(() => expect(screen.getByText("invitee-of-a@uni.edu")).toBeInTheDocument());

      // User B signs in on the same client and may not share this experiment.
      mockSession({ id: "user-b" });
      server.mount(contract.experiments.getExperimentAccess, {
        body: accessPayload({
          isAdmin: false,
          capabilities: {
            canContribute: true,
            canUpdate: false,
            canManage: false,
            canShare: false,
            canLeave: false,
          },
        }),
      });
      rerender(element());

      // The assertions that fail without a principal in the keys: B must not read
      // A's capabilities, collaborators or invitee emails — not even for one frame,
      // before B's own access response lands.
      expect(screen.queryByText("invitee-of-a@uni.edu")).not.toBeInTheDocument();
      expect(screen.queryByText("Asha Okafor")).not.toBeInTheDocument();

      // ...and once B's own access settles, B holds neither capability, so no tab
      // strip survives the switch at all.
      await waitFor(() => expect(screen.queryAllByRole("tablist")).toHaveLength(0));
      expect(screen.queryByText("invitee-of-a@uni.edu")).not.toBeInTheDocument();
      expect(screen.queryByText("Asha Okafor")).not.toBeInTheDocument();
    });

    it("disables the invite action without can(share)", async () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: accessPayload({
          capabilities: {
            canContribute: true,
            canUpdate: true,
            canManage: true,
            canShare: false,
            canLeave: false,
          },
        }),
      });

      renderPage();

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /experimentSettings.invite/ })).toBeDisabled(),
      );
    });

    it("disables the invite action on an archived experiment", async () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: accessPayload({ experiment: { id: experimentId, status: "archived" } }),
      });

      renderPage();

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /experimentSettings.invite/ })).toBeDisabled(),
      );
    });
  });

  describe("manage gate", () => {
    it("hides the requests tab — and fetches nothing — without can(manage)", async () => {
      const joinRequestsSpy = server.mount(contract.experiments.listJoinRequests, { body: [] });
      server.mount(contract.experiments.getExperimentAccess, {
        body: accessPayload({
          isAdmin: false,
          capabilities: {
            canContribute: false,
            canUpdate: false,
            canManage: false,
            canShare: false,
            canLeave: false,
          },
        }),
      });

      renderPage();

      await waitFor(() =>
        expect(screen.getByText("experimentSettings.collaborators")).toBeInTheDocument(),
      );

      expect(screen.queryByText("experimentSettings.requestsTab")).not.toBeInTheDocument();
      // A 403 read as an empty list is the failure this guards: the request must
      // not be filed at all.
      expect(joinRequestsSpy.called).toBe(false);
    });

    it("leaves a viewer with no capability an empty strip, filter or invite action", async () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: accessPayload({
          isAdmin: false,
          capabilities: {
            canContribute: false,
            canUpdate: false,
            canManage: false,
            canShare: false,
            canLeave: false,
          },
        }),
      });

      renderPage();

      await waitFor(() =>
        expect(screen.getByText("experimentSettings.collaborators")).toBeInTheDocument(),
      );

      // No tab strip at all rather than a bare strip, and nothing to drive it with.
      expect(screen.queryAllByRole("tablist")).toHaveLength(0);
      expect(
        screen.queryByPlaceholderText("experimentSettings.filterCollaboratorsPlaceholder"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /experimentSettings.invite/ }),
      ).not.toBeInTheDocument();
    });

    it("keeps the leave card for a viewer grantee once the tabs are gone", async () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: accessPayload({
          isAdmin: false,
          capabilities: {
            canContribute: true,
            canUpdate: false,
            canManage: false,
            canShare: false,
            canLeave: true,
          },
        }),
      });

      renderPage();

      await waitFor(() => expect(screen.getByText("sharing.yourAccessTitle")).toBeInTheDocument());
      expect(screen.queryAllByRole("tablist")).toHaveLength(0);
      expect(screen.getByRole("button", { name: /sharing.leaveAction/ })).toBeInTheDocument();
    });

    it("shows the requests tab — and fetches it — with can(manage)", async () => {
      const joinRequestsSpy = server.mount(contract.experiments.listJoinRequests, { body: [] });
      server.mount(contract.experiments.getExperimentAccess, { body: accessPayload() });

      renderPage();

      await waitFor(() =>
        expect(
          within(tabStrips()[0]).getByRole("tab", { name: /experimentSettings.requestsTab/ }),
        ).toBeInTheDocument(),
      );
      await waitFor(() => expect(joinRequestsSpy.called).toBe(true));
    });
  });

  describe("invite modal", () => {
    it("hints what a tier buys on a private experiment", async () => {
      const user = userEvent.setup();
      server.mount(contract.experiments.getExperimentAccess, {
        body: accessPayload({ experiment: { id: experimentId, visibility: "private" } }),
      });

      renderPage();

      await waitFor(() =>
        expect(screen.getByText("experimentSettings.collaborators")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: /experimentSettings.invite/ }));

      expect(screen.getByText("sharing.experimentTierHint")).toBeInTheDocument();
      expect(screen.queryByText("sharing.publicExperimentTierHint")).not.toBeInTheDocument();
    });

    it("hints that everyone can already view a public experiment", async () => {
      const user = userEvent.setup();
      server.mount(contract.experiments.getExperimentAccess, {
        body: accessPayload({ experiment: { id: experimentId, visibility: "public" } }),
      });

      renderPage();

      await waitFor(() =>
        expect(screen.getByText("experimentSettings.collaborators")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: /experimentSettings.invite/ }));

      expect(screen.getByText("sharing.publicExperimentTierHint")).toBeInTheDocument();
      expect(screen.queryByText("sharing.experimentTierHint")).not.toBeInTheDocument();
    });

    it("closes itself when can(share) is lost while it is open", async () => {
      const user = userEvent.setup();
      const queryClient = createTestQueryClient();
      server.mount(contract.experiments.getExperimentAccess, { body: accessPayload() });

      const { rerender } = render(element(), { queryClient });

      await waitFor(() =>
        expect(screen.getByText("experimentSettings.collaborators")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: /experimentSettings.invite/ }));
      expect(screen.getByLabelText("sharing.granteeSearchLabel")).toBeInTheDocument();

      // A demotion elsewhere lands on the next access refetch while the form is up.
      // Only can(share) is lost here, so the surface itself stays up around it.
      server.mount(contract.experiments.getExperimentAccess, {
        body: accessPayload({
          capabilities: {
            canContribute: true,
            canUpdate: true,
            canManage: true,
            canShare: false,
            canLeave: false,
          },
        }),
      });
      await queryClient.invalidateQueries();
      rerender(element());

      // The form goes away rather than waiting for the server to refuse a submission.
      await waitFor(() =>
        expect(screen.queryByLabelText("sharing.granteeSearchLabel")).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("button", { name: /experimentSettings.invite/ })).toBeDisabled();
    });

    it("does not re-offer an address that already has a pending invitation", async () => {
      const user = userEvent.setup();
      server.mount(contract.users.listInvitations, {
        body: [createInvitation({ email: "pending@uni.edu" })],
      });
      server.mount(contract.users.searchUsers, { body: [] });
      server.mount(contract.experiments.getExperimentAccess, { body: accessPayload() });

      renderPage();

      await waitFor(() =>
        expect(screen.getByText("experimentSettings.collaborators")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: /experimentSettings.invite/ }));
      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "pending@uni.edu");

      await waitFor(() =>
        expect(screen.getByText("sharing.emailAlreadyInvited")).toBeInTheDocument(),
      );
    });
  });
});
