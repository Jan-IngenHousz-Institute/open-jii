import { NewOrganizationIdentityCard } from "@/components/new-organization/new-organization-identity-card";
import type { NewOrganizationFormValues } from "@/components/new-organization/steps/form-step";
import { NO_TYPE } from "@/components/new-organization/steps/form-step";
import { getOrganizationColumns } from "@/components/overview-table/organization-columns";
import {
  createOrganizationDirectoryEntry,
  createOrganizationProfile,
  createOrganizationResource,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, renderWithForm, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { ListOrganizations } from "./list-organizations";
import { OrganizationJoinCta } from "./organization-join-cta";
import { OrganizationSettingsSurface } from "./organization-settings-surface";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

function mountAccess(isPlatformAdmin: boolean) {
  server.mount(contract.users.getPlatformAdminAccess, { body: { isPlatformAdmin } });
}

const NO_TOTALS = {
  experiment: 0,
  protocol: 0,
  macro: 0,
  workbook: 0,
  device: 0,
  device_group: 0,
  calibration_definition: 0,
};

const visibilityBeforeDemo: { current: NewOrganizationFormValues["visibility"] | null } = {
  current: null,
};

function renderIdentity(type: string = NO_TYPE, visibility: "private" | "public" = "private") {
  return renderWithForm<NewOrganizationFormValues>(
    (form) => (
      <NewOrganizationIdentityCard
        form={form}
        takenSlugs={new Set()}
        visibilityBeforeDemo={visibilityBeforeDemo}
      />
    ),
    {
      useFormProps: {
        defaultValues: {
          name: "Greenhouse Lab",
          slug: "greenhouse-lab",
          type: type as NewOrganizationFormValues["type"],
          description: "",
          website: "",
          location: "",
          visibility,
          people: [],
        },
      },
    },
  );
}

describe("Demo is reserved for platform admins", () => {
  afterEach(() => mockSession(null));

  it("offers Demo in the new-organization wizard to a platform admin only", async () => {
    const user = userEvent.setup();
    mockSession({ id: "admin" });
    mountAccess(false);
    const ordinary = renderIdentity();
    await user.click(screen.getByRole("combobox"));
    expect(
      await screen.findByRole("option", { name: "organizations.types.university" }),
    ).toBeVisible();
    expect(screen.queryByRole("option", { name: "organizations.types.demo" })).toBeNull();
    ordinary.unmount();

    mountAccess(true);
    renderIdentity();
    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByRole("option", { name: "organizations.types.demo" })).toBeVisible();
  });

  it("gives back the visibility Demo overwrote when another type is chosen", async () => {
    const user = userEvent.setup();
    mockSession({ id: "admin" });
    mountAccess(true);
    const { form } = renderIdentity();
    const getValues = form.getValues;
    expect(getValues("visibility")).toBe("private");

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "organizations.types.demo" }));
    expect(getValues("visibility")).toBe("public");

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "organizations.types.university" }));
    expect(getValues("visibility")).toBe("private");
  });

  it("hides Demo from an owner who is not a platform admin and locks an existing Demo type", async () => {
    const user = userEvent.setup();
    mockSession({ id: "owner" });
    mountAccess(false);
    server.mount(contract.organizations.getOrganization, {
      body: createOrganizationProfile({ id: "org-1", role: "owner", type: "university" }),
    });
    server.mount(contract.organizations.listOrganizationResources, {
      body: { resources: [], totals: NO_TOTALS },
    });
    const ordinary = render(<OrganizationSettingsSurface organizationId="org-1" />);
    await user.click(await screen.findByLabelText("organizations.fields.type"));
    expect(
      await screen.findByRole("option", { name: "organizations.types.university" }),
    ).toBeVisible();
    expect(screen.queryByRole("option", { name: "organizations.types.demo" })).toBeNull();
    ordinary.unmount();

    server.mount(contract.organizations.getOrganization, {
      body: createOrganizationProfile({
        id: "org-1",
        role: "owner",
        type: "demo",
        visibility: "public",
      }),
    });
    render(<OrganizationSettingsSurface organizationId="org-1" />);
    expect(await screen.findByLabelText("organizations.fields.type")).toBeDisabled();
  });

  it("shows Public as chosen and rules Private out as soon as Demo is picked in settings", async () => {
    const user = userEvent.setup();
    mockSession({ id: "owner" });
    mountAccess(true);
    server.mount(contract.organizations.getOrganization, {
      body: createOrganizationProfile({
        id: "org-1",
        role: "owner",
        type: "university",
        visibility: "private",
      }),
    });
    server.mount(contract.organizations.listOrganizationResources, {
      body: { resources: [createOrganizationResource()], totals: NO_TOTALS },
    });
    render(<OrganizationSettingsSurface organizationId="org-1" />);

    const privateCard = await screen.findByRole("radio", {
      name: /organizations.visibility.privateLabel/u,
    });
    expect(privateCard).toBeChecked();
    expect(privateCard).toBeEnabled();

    await user.click(screen.getByLabelText("organizations.fields.type"));
    await user.click(await screen.findByRole("option", { name: "organizations.types.demo" }));

    const publicCard = screen.getByRole("radio", { name: /organizations.visibility.publicLabel/u });
    expect(publicCard).toBeChecked();
    expect(privateCard).not.toBeChecked();
    expect(privateCard).toBeDisabled();
  });
});

describe("Demo organizations take no join requests", () => {
  it("renders no join control for a Demo organization", () => {
    const { container } = render(
      <OrganizationJoinCta
        isDemo
        organizationId="org-9"
        organizationName="Demo Lab"
        membershipStatus="none"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the join control for an ordinary public organization", () => {
    render(
      <OrganizationJoinCta
        organizationId="org-9"
        organizationName="Greenhouse Lab"
        membershipStatus="none"
      />,
    );
    expect(
      screen.getByRole("button", { name: "organizations.join.requestAction" }),
    ).toBeInTheDocument();
  });
});

describe("Demo in the directory", () => {
  afterEach(() => mockSession(null));

  it("badges Demo rows and nothing else", () => {
    const columns = getOrganizationColumns((key) => key);
    const cell = columns[0].cell;
    const { rerender } = render(
      <>
        {cell(
          {
            id: "d",
            name: "Demo Lab",
            description: null,
            memberCount: 1,
            resourceCount: 1,
            visibility: "public",
            type: "demo",
            isMember: false,
          },
          "/x",
        )}
      </>,
    );
    expect(screen.getByText("organizations.types.demo")).toBeInTheDocument();
    rerender(
      <>
        {cell(
          {
            id: "u",
            name: "Uni Lab",
            description: null,
            memberCount: 1,
            resourceCount: 1,
            visibility: "public",
            type: "university",
            isMember: false,
          },
          "/x",
        )}
      </>,
    );
    expect(screen.queryByText("organizations.types.demo")).toBeNull();
  });

  it("filters the directory to Demo organizations", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    server.mount(contract.organizations.listOrganizations, {
      body: {
        organizations: [
          createOrganizationDirectoryEntry({ id: "demo", name: "Demo Lab", type: "demo" }),
          createOrganizationDirectoryEntry({ id: "uni", name: "Uni Lab", type: "university" }),
        ],
      },
    });
    render(<ListOrganizations />);
    await screen.findByText("Uni Lab");
    expect(screen.getByText("Demo Lab")).toBeVisible();

    await user.click(screen.getByRole("combobox", { name: "organizations.fields.type" }));
    await user.click(await screen.findByRole("option", { name: "organizations.types.demo" }));

    await waitFor(() => expect(screen.queryByText("Uni Lab")).toBeNull());
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Demo Lab")).toBeVisible();
  });
});
