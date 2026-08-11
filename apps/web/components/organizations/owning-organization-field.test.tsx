import { createMyOrganization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { MyOrganization } from "@repo/api/domains/organization/organization.schema";
import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { OwningOrganizationField } from "./owning-organization-field";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

function mountMyOrganizations(organizations: MyOrganization[]) {
  return server.mount(contract.organizations.listMyOrganizations, { body: organizations });
}

function renderField(
  overrides: Partial<React.ComponentProps<typeof OwningOrganizationField>> = {},
) {
  return render(
    <OwningOrganizationField
      resourceType="macro"
      resourceId="00000000-0000-0000-0000-00000000000a"
      organizationId="org-lab"
      organizationName="Greenhouse Lab"
      canTransfer
      {...overrides}
    />,
  );
}

/**
 * Transfer lives on the owning-organization value itself, modelled on the locations
 * field in the experiment header: the label row carries an inline affordance that
 * opens the flow in a dialog. Before this it sat in each type's danger zone or action
 * row, which put the answer and the way to change it in two different places.
 */
describe("<OwningOrganizationField />", () => {
  afterEach(() => {
    mockSession(null);
  });

  it("shows the owning organization with the transfer affordance on its label row", () => {
    mockSession({ id: "user-1" });
    mountMyOrganizations([createMyOrganization({ id: "org-other", name: "Other Lab" })]);

    renderField();

    expect(screen.getByText("organizations.owningOrganization")).toBeVisible();
    expect(screen.getByRole("link", { name: "Greenhouse Lab" })).toBeVisible();
    expect(screen.getByRole("button", { name: "organizations.transfer.action" })).toBeVisible();
  });

  it("renders the plain value, and asks for no memberships, without canTransfer", async () => {
    mockSession({ id: "user-1" });
    const spy = mountMyOrganizations([createMyOrganization({ id: "org-other" })]);

    renderField({ canTransfer: false });

    // `canManage` is not enough for this action, so a manager who cannot transfer
    // gets the value and no affordance at all — not a disabled one.
    expect(screen.getByRole("link", { name: "Greenhouse Lab" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "organizations.transfer.action" }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(spy.called).toBe(false);
    });
  });

  it("keeps the value readable for a personal workspace, with no affordance to link", () => {
    mockSession({ id: "user-1" });
    mountMyOrganizations([createMyOrganization({ id: "org-other" })]);

    renderField({ organizationName: null, canTransfer: false });

    expect(screen.getByText("organizations.picker.personal")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("opens the transfer flow from the affordance", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountMyOrganizations([createMyOrganization({ id: "org-other", name: "Other Lab" })]);

    renderField();

    await user.click(screen.getByRole("button", { name: "organizations.transfer.action" }));

    expect(await screen.findByText("organizations.transfer.dialogTitle")).toBeVisible();
  });

  it("does not offer the organization that already owns the resource", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountMyOrganizations([
      createMyOrganization({ id: "org-lab", name: "Greenhouse Lab" }),
      createMyOrganization({ id: "org-other", name: "Other Lab" }),
      createMyOrganization({ id: "org-personal", name: "Ada's workspace", isPersonal: true }),
    ]);

    renderField();

    await user.click(screen.getByRole("button", { name: "organizations.transfer.action" }));
    await user.click(
      await screen.findByRole("combobox", { name: "organizations.transfer.targetLabel" }),
    );

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Other Lab",
      // A personal workspace is a legitimate destination — it is the way out for a
      // resource stranded in an organization with no owners left.
      "organizations.picker.personal",
    ]);
  });

  it("transfers to the chosen organization", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountMyOrganizations([createMyOrganization({ id: "org-other", name: "Other Lab" })]);
    const transferSpy = server.mount(contract.sharing.transferResourceOrganization, {
      body: {
        resourceType: "macro",
        resourceId: "00000000-0000-0000-0000-00000000000a",
        organizationId: "org-other",
      },
    });

    renderField();

    await user.click(screen.getByRole("button", { name: "organizations.transfer.action" }));
    await user.click(
      await screen.findByRole("combobox", { name: "organizations.transfer.targetLabel" }),
    );
    await user.click(screen.getByRole("option", { name: "Other Lab" }));
    await user.click(screen.getByRole("button", { name: "organizations.transfer.confirm" }));

    await waitFor(() => {
      expect(transferSpy.called).toBe(true);
    });
    expect(transferSpy.params).toMatchObject({ resourceType: "macro" });
    expect(transferSpy.body).toEqual({ targetOrganizationId: "org-other" });
  });

  it("surfaces a raced server refusal rather than a generic failure", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountMyOrganizations([createMyOrganization({ id: "org-other", name: "Other Lab" })]);
    server.mount(contract.sharing.transferResourceOrganization, {
      status: 403,
      body: { message: "You are not allowed to transfer this resource" },
    });

    renderField();

    await user.click(screen.getByRole("button", { name: "organizations.transfer.action" }));
    await user.click(
      await screen.findByRole("combobox", { name: "organizations.transfer.targetLabel" }),
    );
    await user.click(screen.getByRole("option", { name: "Other Lab" }));
    await user.click(screen.getByRole("button", { name: "organizations.transfer.confirm" }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "You are not allowed to transfer this resource",
          variant: "destructive",
        }),
      );
    });
  });

  it("says so rather than offering an empty picker when there is nowhere to go", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountMyOrganizations([createMyOrganization({ id: "org-lab", name: "Greenhouse Lab" })]);

    renderField();

    await user.click(screen.getByRole("button", { name: "organizations.transfer.action" }));

    const trigger = await screen.findByRole("combobox", {
      name: "organizations.transfer.targetLabel",
    });
    await waitFor(() => {
      expect(trigger).toBeDisabled();
    });
    expect(trigger).toHaveTextContent("organizations.transfer.noTargets");
    expect(screen.getByRole("button", { name: "organizations.transfer.confirm" })).toBeDisabled();
  });

  it("keeps the provenance-strip layout's own typography", () => {
    mockSession({ id: "user-1" });
    mountMyOrganizations([createMyOrganization({ id: "org-other" })]);

    renderField({ layout: "meta" });

    // The workbook strip labels each column above its value, so the affordance sits
    // beside the label rather than pushed to a far edge it does not have.
    expect(screen.getByText("organizations.owningOrganization")).toBeVisible();
    expect(screen.getByRole("button", { name: "organizations.transfer.action" })).toBeVisible();
  });
});
