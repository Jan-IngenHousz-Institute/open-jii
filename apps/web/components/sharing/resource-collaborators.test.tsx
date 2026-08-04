import { createResourceGrant, createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { createTestQueryClient, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { ResourceCollaborators } from "./resource-collaborators";

/** Point the globally-mocked `useSession` at a given principal (or at "loading"). */
function mockSession(user: { id: string } | null, isPending = false) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending,
  } as ReturnType<typeof useSession>);
}

function renderCollaborators(
  overrides: Partial<React.ComponentProps<typeof ResourceCollaborators>> = {},
) {
  return render(<ResourceCollaborators resourceType="macro" resourceId="macro-1" {...overrides} />);
}

describe("<ResourceCollaborators />", () => {
  afterEach(() => {
    // Restore the suite-wide default (signed out, session resolved).
    mockSession(null);
  });

  it("renders nothing when the share-gated list endpoint returns 403", async () => {
    const listSpy = server.mount(contract.sharing.listGrants, {
      status: 403,
      body: { message: "Forbidden" },
    });

    const { container } = renderCollaborators();

    await waitFor(() => expect(listSpy.called).toBe(true));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    // No heading ever appeared for a caller who cannot share.
    expect(screen.queryByText("sharing.cardTitle")).not.toBeInTheDocument();
  });

  it("renders nothing when the resource is not found (404)", async () => {
    server.mount(contract.sharing.listGrants, { status: 404, body: { message: "Not found" } });

    const { container } = renderCollaborators();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("renders nothing while the capability probe is in flight", () => {
    server.mount(contract.sharing.listGrants, { delay: "infinite", body: [] });

    const { container } = renderCollaborators();

    // No flash of a heading that would then disappear for most viewers.
    expect(container).toBeEmptyDOMElement();
  });

  it("skips the request entirely when the page already knows the user cannot share", async () => {
    const listSpy = server.mount(contract.sharing.listGrants, { body: [] });

    const { container } = renderCollaborators({ canShare: false });

    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(listSpy.called).toBe(false));
  });

  it("shows the invite action and the empty state for a sharer with no collaborators", async () => {
    server.mount(contract.sharing.listGrants, { body: [] });

    renderCollaborators();

    await waitFor(() => expect(screen.getByText("sharing.cardTitle")).toBeInTheDocument());
    expect(screen.getByText("sharing.noCollaboratorsYet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sharing.invite/ })).toBeInTheDocument();
  });

  it("puts the filter and the Invite action in one row above the list", async () => {
    server.mount(contract.sharing.listGrants, { body: [] });

    renderCollaborators();

    const filter = await screen.findByPlaceholderText("sharing.filterCollaboratorsPlaceholder");
    const invite = screen.getByRole("button", { name: /sharing.invite/ });
    const list = screen.getByText("sharing.noCollaboratorsYet");

    // Same row as the CTA, and both ahead of the roster they act on.
    expect(filter.closest("div")?.parentElement).toBe(invite.parentElement);
    expect(filter.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps *user search* behind the modal — the panel's own field only filters", async () => {
    server.mount(contract.sharing.listGrants, { body: [] });

    renderCollaborators();

    await waitFor(() => expect(screen.getByText("sharing.cardTitle")).toBeInTheDocument());

    // The only surface that reaches the user directory lives inside the dialog,
    // which is closed.
    expect(screen.queryByLabelText("sharing.granteeSearchLabel")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: /sharing.invite/ }));

    expect(screen.getByLabelText("sharing.granteeSearchLabel")).toBeInTheDocument();
  });

  describe("filtering", () => {
    const rows = [
      createResourceGrant({
        id: "g-lin",
        granteeId: "u-lin",
        grantee: { type: "user", displayName: "Lin Zhao", email: "lin@uni.edu", avatarUrl: null },
      }),
      createResourceGrant({
        id: "g-asha",
        granteeId: "u-asha",
        grantee: {
          type: "user",
          displayName: "Asha Okafor",
          email: "asha@greenhouse.lab",
          avatarUrl: null,
        },
      }),
    ];

    it("narrows the rows by name or email", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.listGrants, { body: rows });

      renderCollaborators();

      await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());

      const filter = screen.getByPlaceholderText("sharing.filterCollaboratorsPlaceholder");
      await user.type(filter, "greenhouse");

      expect(screen.getByText("Asha Okafor")).toBeInTheDocument();
      expect(screen.queryByText("Lin Zhao")).not.toBeInTheDocument();
    });

    it("reads an empty result as 'no match' rather than 'none yet'", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.listGrants, { body: rows });

      renderCollaborators();

      await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());

      await user.type(
        screen.getByPlaceholderText("sharing.filterCollaboratorsPlaceholder"),
        "nobody",
      );

      expect(screen.getByText("sharing.noMatchingCollaborators")).toBeInTheDocument();
      expect(screen.queryByText("sharing.noCollaboratorsYet")).not.toBeInTheDocument();
    });

    it("still dedupes the invite dialog against everyone, not just the visible rows", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.listGrants, { body: rows });
      server.mount(contract.users.searchUsers, {
        body: [
          createUserProfile({
            userId: "u-lin",
            firstName: "Lin",
            lastName: "Zhao",
            email: "lin@uni.edu",
          }),
        ],
      });

      renderCollaborators();

      await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());

      // Filter Lin out of the list, then try to invite her anyway.
      await user.type(
        screen.getByPlaceholderText("sharing.filterCollaboratorsPlaceholder"),
        "greenhouse",
      );
      expect(screen.queryByText("Lin Zhao")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /sharing.invite/ }));
      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "lin@uni.edu");

      // Still recognised as a collaborator, so she is neither offered as a row nor
      // as an email invitation — which is what a filtered `existingGranteeIds`
      // would have broken.
      await waitFor(() =>
        expect(screen.getByText("sharing.emailAlreadyCollaborator")).toBeInTheDocument(),
      );
    });
  });

  it("lists the direct grants it loaded", async () => {
    server.mount(contract.sharing.listGrants, {
      body: [
        createResourceGrant({
          role: "viewer",
          grantee: { type: "user", displayName: "Lin Zhao", email: "lin@uni.edu", avatarUrl: null },
        }),
      ],
    });

    renderCollaborators();

    await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
    expect(screen.getByRole("combobox")).toHaveTextContent("sharing.roleCanView");
  });

  it("adds a collaborator through the modal and shows them in the list", async () => {
    const user = userEvent.setup();
    const shared = createResourceGrant({
      id: "g-new",
      resourceType: "macro",
      resourceId: "macro-1",
      granteeId: "u-1",
      role: "viewer",
      isOutsideCollaborator: true,
      grantee: { type: "user", displayName: "Lin Zhao", email: "lin@uni.edu", avatarUrl: null },
    });

    server.mount(contract.sharing.listGrants, { body: [] });
    server.mount(contract.users.searchUsers, {
      body: [
        createUserProfile({
          userId: "u-1",
          firstName: "Lin",
          lastName: "Zhao",
          email: "lin@uni.edu",
        }),
      ],
    });
    const createSpy = server.mount(contract.sharing.createGrant, { body: [shared] });

    renderCollaborators();

    await waitFor(() => expect(screen.getByText("sharing.noCollaboratorsYet")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /sharing.invite/ }));
    await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "lin");
    await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
    await user.click(screen.getByText("Lin Zhao"));

    // Keep the refetch consistent with the mutation's response.
    server.mount(contract.sharing.listGrants, { body: [shared] });
    await user.click(screen.getByRole("button", { name: "common.add" }));

    await waitFor(() => expect(createSpy.called).toBe(true));
    expect(createSpy.body).toEqual({ granteeType: "user", granteeId: "u-1", role: "viewer" });

    await waitFor(() =>
      expect(screen.queryByText("sharing.noCollaboratorsYet")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Lin Zhao")).toBeInTheDocument();
    expect(screen.getByText("sharing.outsideCollaborator")).toBeInTheDocument();
  });

  it("locks the add action when read-only", async () => {
    server.mount(contract.sharing.listGrants, { body: [] });

    renderCollaborators({ readOnly: true });

    await waitFor(() => expect(screen.getByText("sharing.cardTitle")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /sharing.invite/ })).toBeDisabled();
  });

  describe("principal scoping", () => {
    it("never renders one user's cached collaborators for the next user on the same client", async () => {
      // One QueryClient across both sessions, like the app's module-level client
      // surviving a client-side sign-out → sign-in.
      const queryClient = createTestQueryClient();

      mockSession({ id: "user-a" });
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

      // A fresh element each time: React bails out of re-rendering an
      // identical element object, which would mask the session switch.
      const element = () => <ResourceCollaborators resourceType="macro" resourceId="macro-1" />;
      const { rerender } = render(element(), { queryClient });

      // User A may share, so they see their collaborator.
      await waitFor(() => expect(screen.getByText("Asha Okafor")).toBeInTheDocument());

      // User B signs in on the same client and may *not* share this macro.
      mockSession({ id: "user-b" });
      server.mount(contract.sharing.listGrants, {
        status: 403,
        body: { message: "Forbidden" },
      });
      rerender(element());

      // The assertion that fails without a principal in the key: B must not see
      // A's list even for one frame, before B's own probe resolves.
      expect(screen.queryByText("Asha Okafor")).not.toBeInTheDocument();

      // ...and it never appears once B's 403 settles either.
      await waitFor(() => expect(screen.queryByText("sharing.cardTitle")).not.toBeInTheDocument());
      expect(screen.queryByText("Asha Okafor")).not.toBeInTheDocument();
    });

    it("fetches nothing until the session resolves", async () => {
      mockSession(null, true);
      const listSpy = server.mount(contract.sharing.listGrants, { body: [] });

      const { container } = renderCollaborators();

      // Nothing may be requested — and so nothing cached — under a principal we
      // do not know yet; the surface fails closed meanwhile.
      expect(container).toBeEmptyDOMElement();
      await waitFor(() => expect(listSpy.called).toBe(false));
    });
  });
});
