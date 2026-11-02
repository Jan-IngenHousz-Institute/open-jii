import { createGranteeUser } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { FRESH_FOR_MS } from "~/providers/QueryProvider";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { CollaboratorInviteDialog } from "./collaborator-invite-dialog";

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof CollaboratorInviteDialog>> = {},
) {
  const onOpenChange = vi.fn();
  const result = render(
    <CollaboratorInviteDialog
      resourceType="experiment"
      resourceId="exp-1"
      open
      onOpenChange={onOpenChange}
      title="Invite collaborators"
      description="Add someone to this experiment"
      {...overrides}
    />,
  );
  return { ...result, onOpenChange };
}

async function pickUser(name: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), name.split(" ")[0]);
  await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument());
  await user.click(screen.getByText(name));
  return user;
}

describe("<CollaboratorInviteDialog />", () => {
  it("grants the chosen tier to a picked user", async () => {
    server.mount(contract.sharing.searchGranteeUsers, {
      body: [
        createGranteeUser({
          userId: "u-1",
          firstName: "Lin",
          lastName: "Zhao",
          email: "lin@uni.edu",
        }),
      ],
    });
    const createSpy = server.mount(contract.sharing.createGrant, { body: [] });

    const { onOpenChange } = renderDialog();

    // Nothing to submit until a grantee is picked.
    expect(screen.getByRole("button", { name: "common.add" })).toBeDisabled();

    const user = await pickUser("Lin Zhao");

    // Least privilege by default — which on an experiment is the contributing tier.
    expect(screen.getByLabelText("sharing.newShareRoleLabel")).toHaveTextContent(
      "sharing.roleCanView",
    );

    await user.click(screen.getByRole("button", { name: "common.add" }));

    await waitFor(() => expect(createSpy.called).toBe(true));
    expect(createSpy.body).toEqual({ granteeType: "user", granteeId: "u-1", role: "viewer" });
    expect(createSpy.params).toMatchObject({ resourceType: "experiment", id: "exp-1" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("grants 'Can edit' when the tier is raised", async () => {
    server.mount(contract.sharing.searchGranteeUsers, {
      body: [createGranteeUser({ userId: "u-2", firstName: "Asha", lastName: "Okafor" })],
    });
    const createSpy = server.mount(contract.sharing.createGrant, { body: [] });

    renderDialog();

    const user = await pickUser("Asha Okafor");

    await user.click(screen.getByLabelText("sharing.newShareRoleLabel"));
    await user.click(screen.getByRole("option", { name: "sharing.roleCanEdit" }));
    await user.click(screen.getByRole("button", { name: "common.add" }));

    await waitFor(() => expect(createSpy.called).toBe(true));
    expect(createSpy.body).toMatchObject({ granteeId: "u-2", role: "admin" });
  });

  it("refuses a tier lowered onto a grantee it would no longer raise", async () => {
    server.mount(contract.sharing.searchGranteeUsers, {
      body: [
        createGranteeUser({
          userId: "u-1",
          firstName: "Lin",
          lastName: "Zhao",
          existingGrantRole: "viewer",
        }),
      ],
    });
    const createSpy = server.mount(contract.sharing.createGrant, { body: [] });

    renderDialog();

    // Picked while "Can edit" would raise her, then the tier is dropped back to
    // what she already holds — the picker's own verdict is stale by then.
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("sharing.newShareRoleLabel"));
    await user.click(screen.getByRole("option", { name: "sharing.roleCanEdit" }));
    await pickUser("Lin Zhao");

    await user.click(screen.getByLabelText("sharing.newShareRoleLabel"));
    await user.click(screen.getByRole("option", { name: "sharing.roleCanView" }));

    expect(screen.getByText("sharing.granteeTierAddsNothing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.add" })).toBeDisabled();
    expect(createSpy.called).toBe(false);
  });

  it("shows a person just shared with as already holding the tier when searched again", async () => {
    // The app keeps answers fresh for a while, and the shared test client keeps none,
    // which would hide a search answer that outlived the share made after it.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: FRESH_FOR_MS, retry: false } },
    });
    let shared = false;
    server.mount(contract.sharing.searchGranteeUsers, {
      body: () => [
        createGranteeUser({
          userId: "u-1",
          firstName: "Lin",
          lastName: "Zhao",
          existingGrantRole: shared ? "viewer" : null,
        }),
      ],
    });
    server.mount(contract.sharing.createGrant, {
      body: () => {
        shared = true;
        return [];
      },
    });
    const onOpenChange = vi.fn();
    const dialog = (open: boolean) => (
      <CollaboratorInviteDialog
        resourceType="experiment"
        resourceId="exp-1"
        open={open}
        onOpenChange={onOpenChange}
        title="Invite collaborators"
        description="Add someone to this experiment"
      />
    );

    const { rerender } = render(dialog(true), { queryClient });
    const user = await pickUser("Lin Zhao");
    await user.click(screen.getByRole("button", { name: "common.add" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    rerender(dialog(false));
    rerender(dialog(true));

    await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "Lin");

    await waitFor(() =>
      expect(screen.getByText("sharing.granteeTierAddsNothing")).toBeInTheDocument(),
    );
    expect(screen.getByText("Lin Zhao").closest("button")).toBeDisabled();
  });

  it("refuses a level lowered onto an organization's existing share", async () => {
    server.mount(contract.sharing.searchGranteeOrganizations, {
      body: [{ id: "org-1", name: "Greenhouse Lab", slug: "greenhouse-lab" }],
    });
    const createSpy = server.mount(contract.sharing.createGrant, { body: [] });

    renderDialog({
      existingGrants: [{ granteeType: "organization", granteeId: "org-1", role: "viewer" }],
    });

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("sharing.newShareRoleLabel"));
    await user.click(screen.getByRole("option", { name: "sharing.roleCanEdit" }));
    await user.click(screen.getByLabelText("sharing.granteeTypeLabel"));
    await user.click(screen.getByRole("option", { name: "sharing.granteeTypeOrganization" }));
    await user.click(screen.getByLabelText("sharing.granteeSearchLabel"));
    await waitFor(() => expect(screen.getByText("Greenhouse Lab")).toBeInTheDocument());
    await user.click(screen.getByText("Greenhouse Lab"));

    await user.click(screen.getByLabelText("sharing.newShareRoleLabel"));
    await user.click(screen.getByRole("option", { name: "sharing.roleCanView" }));

    expect(screen.getByText("sharing.granteeTierAddsNothing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.add" })).toBeDisabled();
    expect(createSpy.called).toBe(false);
  });

  it("shares with an organization grantee", async () => {
    server.mount(contract.sharing.searchGranteeOrganizations, {
      body: [{ id: "org-1", name: "Greenhouse Lab", slug: "greenhouse-lab" }],
    });
    const createSpy = server.mount(contract.sharing.createGrant, { body: [] });

    renderDialog();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("sharing.granteeTypeLabel"));
    await user.click(screen.getByRole("option", { name: "sharing.granteeTypeOrganization" }));
    await user.click(screen.getByLabelText("sharing.granteeSearchLabel"));
    await waitFor(() => expect(screen.getByText("Greenhouse Lab")).toBeInTheDocument());
    await user.click(screen.getByText("Greenhouse Lab"));
    await user.click(screen.getByRole("button", { name: "common.add" }));

    await waitFor(() => expect(createSpy.called).toBe(true));
    expect(createSpy.body).toMatchObject({ granteeType: "organization", granteeId: "org-1" });
  });

  it("sends a typed address to the host's invitation handler with the chosen tier", async () => {
    server.mount(contract.sharing.searchGranteeUsers, { body: [] });
    const onEmailInvite = vi.fn().mockResolvedValue(undefined);
    const createSpy = server.mount(contract.sharing.createGrant, { body: [] });

    const { onOpenChange } = renderDialog({ onEmailInvite });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "new@uni.edu");
    await waitFor(() => expect(screen.getByText("sharing.sendInviteByEmail")).toBeInTheDocument());
    await user.click(screen.getByText("sharing.sendInviteByEmail"));

    await user.click(screen.getByLabelText("sharing.newShareRoleLabel"));
    await user.click(screen.getByRole("option", { name: "sharing.roleCanEdit" }));
    await user.click(screen.getByRole("button", { name: "common.add" }));

    await waitFor(() => expect(onEmailInvite).toHaveBeenCalledWith("new@uni.edu", "admin"));
    // An address with no account cannot be granted anything yet.
    expect(createSpy.called).toBe(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog and the picked grantee open when the share is refused", async () => {
    server.mount(contract.sharing.searchGranteeUsers, {
      body: [createGranteeUser({ userId: "u-1", firstName: "Lin", lastName: "Zhao" })],
    });
    server.mount(contract.sharing.createGrant, {
      status: 403,
      body: { message: "Outside collaborators are disabled for this organization" },
    });

    const { onOpenChange } = renderDialog();

    const user = await pickUser("Lin Zhao");
    await user.click(screen.getByRole("button", { name: "common.add" }));

    await waitFor(() =>
      expect(vi.mocked(toast)).toHaveBeenCalledWith({
        description: "Outside collaborators are disabled for this organization",
        variant: "destructive",
      }),
    );
    // The refusal is readable and one click away from a retry.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("sharing.granteeSearchLabel")).toHaveValue("Lin Zhao");
  });

  describe("while a submission is in flight", () => {
    it("refuses every dismissal route, not just the Cancel button", async () => {
      server.mount(contract.sharing.searchGranteeUsers, {
        body: [createGranteeUser({ userId: "u-1", firstName: "Lin", lastName: "Zhao" })],
      });
      // Never settles: the dialog stays mid-submission for the whole test.
      server.mount(contract.sharing.createGrant, { delay: "infinite", body: [] });

      const { onOpenChange } = renderDialog();

      const user = await pickUser("Lin Zhao");
      await user.click(screen.getByRole("button", { name: "common.add" }));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "common.cancel" })).toBeDisabled(),
      );

      // The close button is gone rather than merely inert...
      expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();

      // ...and Escape is a no-op too, so the dialog cannot be reopened with a new
      // selection while the first request is still running.
      await user.keyboard("{Escape}");
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      expect(screen.getByLabelText("sharing.granteeSearchLabel")).toBeInTheDocument();
    });

    it("closes exactly once — on completion, not on the attempted dismissal", async () => {
      server.mount(contract.sharing.searchGranteeUsers, { body: [] });

      // The email path's pending state is a prop, so the whole submission is
      // driven from the test: no timing to race against.
      let completeInvite!: () => void;
      const onEmailInvite = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            completeInvite = resolve;
          }),
      );
      const onOpenChange = vi.fn();
      const dialog = (isEmailInvitePending: boolean) => (
        <CollaboratorInviteDialog
          resourceType="experiment"
          resourceId="exp-1"
          open
          onOpenChange={onOpenChange}
          title="Invite collaborators"
          description="Add someone to this experiment"
          onEmailInvite={onEmailInvite}
          isEmailInvitePending={isEmailInvitePending}
        />
      );

      const user = userEvent.setup();
      const { rerender } = render(dialog(false));

      await user.type(screen.getByLabelText("sharing.granteeSearchLabel"), "new@uni.edu");
      await waitFor(() =>
        expect(screen.getByText("sharing.sendInviteByEmail")).toBeInTheDocument(),
      );
      await user.click(screen.getByText("sharing.sendInviteByEmail"));
      await user.click(screen.getByRole("button", { name: "common.add" }));

      expect(onEmailInvite).toHaveBeenCalledWith("new@uni.edu", "viewer");
      rerender(dialog(true));

      // Dismissed mid-flight and nothing happens, so the dialog can never be
      // reopened with a second selection for the finishing request to clear.
      await user.keyboard("{Escape}");
      expect(onOpenChange).not.toHaveBeenCalledWith(false);

      // Completion is not a dismissal, so it still closes — exactly once.
      completeInvite();

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(onOpenChange.mock.calls.filter(([next]) => next === false)).toHaveLength(1);
    });
  });

  it("renders the tier hint the host supplies", () => {
    renderDialog({ hint: "sharing.publicExperimentTierHint" });

    expect(screen.getByText("sharing.publicExperimentTierHint")).toBeInTheDocument();
  });

  it("stays inert on a frozen resource", () => {
    server.mount(contract.sharing.searchGranteeUsers, {
      body: [createGranteeUser({ userId: "u-1", firstName: "Lin", lastName: "Zhao" })],
    });

    renderDialog({ disabled: true });

    expect(screen.getByLabelText("sharing.granteeSearchLabel")).toBeDisabled();
    expect(screen.getByLabelText("sharing.newShareRoleLabel")).toBeDisabled();
    expect(screen.getByRole("button", { name: "common.add" })).toBeDisabled();
  });
});
