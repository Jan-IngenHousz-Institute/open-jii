import { createOrganizationProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useRouter } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { OrganizationProfile } from "@repo/api/domains/organization/organization.schema";
import { authClient, useSession } from "@repo/auth/client";

import { OrganizationSettingsSurface } from "./organization-settings-surface";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

function mountProfile(overrides: Partial<OrganizationProfile> = {}) {
  return server.mount(contract.organizations.getOrganization, {
    body: createOrganizationProfile({ id: "org-1", name: "Greenhouse Lab", ...overrides }),
  });
}

const update = () => vi.mocked(authClient.organization.update);

describe("<OrganizationSettingsSurface />", () => {
  afterEach(() => {
    mockSession(null);
    update().mockResolvedValue({ data: null, error: null });
  });

  it("renders the settings for an owner", async () => {
    mockSession({ id: "user-1" });
    mountProfile({ role: "owner" });
    // The showcase feeds the danger zone's block reason.
    server.mount(contract.organizations.listOrganizationResources, { body: { resources: [] } });

    render(<OrganizationSettingsSurface organizationId="org-1" />);

    expect(await screen.findByLabelText("organizations.fields.name")).toHaveValue("Greenhouse Lab");
    // Visibility is two radio cards, not a switch: each state needs a sentence.
    expect(
      screen.getByRole("radio", { name: /organizations.visibility.privateLabel/u }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /organizations.visibility.publicLabel/u }),
    ).not.toBeChecked();
    // Nothing is dirty yet, so there is nothing to save.
    expect(screen.queryByRole("button", { name: "common.save" })).toBeNull();
  });

  it.each(["admin", "member"] as const)(
    "renders nothing for an %s and sends them away",
    async (role) => {
      mockSession({ id: "user-1" });
      mountProfile({ role });

      const { container, router } = render(<OrganizationSettingsSurface organizationId="org-1" />);

      // Better Auth's default admin role carries `organization:update`; openJII
      // strips it, so settings are owner-only here and the route refuses too.
      await waitFor(() => {
        expect(vi.mocked(router.replace)).toHaveBeenCalledWith(
          "/en-US/platform/organizations/org-1",
        );
      });
      expect(container.querySelector("input")).toBeNull();
    },
  );

  it("renders nothing while the profile is still unresolved", () => {
    mockSession({ id: "user-1" });
    server.mount(contract.organizations.getOrganization, { delay: "infinite" });

    const { container } = render(<OrganizationSettingsSurface organizationId="org-1" />);

    // Unresolved is not "not an owner": nothing is claimed either way yet.
    expect(container).toBeEmptyDOMElement();
    expect(vi.mocked(useRouter)().replace).not.toHaveBeenCalled();
  });

  it("clears an emptied profile field to null rather than to an empty string", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountProfile({ role: "owner", location: "Wageningen", type: "university" });
    server.mount(contract.organizations.listOrganizationResources, { body: { resources: [] } });

    render(<OrganizationSettingsSurface organizationId="org-1" />);

    await user.clear(await screen.findByLabelText("organizations.fields.location"));
    await user.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(update()).toHaveBeenCalled();
    });
    expect(update().mock.calls[0]?.[0]).toMatchObject({
      organizationId: "org-1",
      data: { location: null },
    });
  });

  it("sends only the visibility change when the other card is chosen", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountProfile({ role: "owner", visibility: "private" });
    server.mount(contract.organizations.listOrganizationResources, { body: { resources: [] } });

    render(<OrganizationSettingsSurface organizationId="org-1" />);

    await user.click(
      await screen.findByRole("radio", { name: /organizations.visibility.publicLabel/u }),
    );

    await waitFor(() => {
      // `visibility` only reaches the database because it is registered as an
      // organization additional field; the plugin drops unknown keys silently.
      expect(update()).toHaveBeenCalledWith({
        organizationId: "org-1",
        data: { visibility: "public" },
      });
    });
  });

  it("refuses to save a slug in the reserved personal namespace", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountProfile({ role: "owner" });
    server.mount(contract.organizations.listOrganizationResources, { body: { resources: [] } });

    render(<OrganizationSettingsSurface organizationId="org-1" />);

    const slug = await screen.findByLabelText("organizations.fields.slug");
    await user.clear(slug);
    await user.type(slug, "personal-lab");

    expect(screen.getByText("organizations.errors.slug.reserved")).toBeVisible();
    expect(screen.getByRole("button", { name: "common.save" })).toBeDisabled();
    expect(update()).not.toHaveBeenCalled();
  });
});

/**
 * The website field is strict, matching the transfer-request form's URL field and the
 * create form exactly: a full `http(s)://…` URL or nothing, stored as typed.
 */
describe("<OrganizationSettingsSurface /> website submission", () => {
  afterEach(() => {
    mockSession(null);
    update().mockResolvedValue({ data: null, error: null });
  });

  it("refuses a bare host, with the error rendered and nothing sent", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountProfile({ role: "owner", website: null });
    server.mount(contract.organizations.listOrganizationResources, { body: { resources: [] } });

    render(<OrganizationSettingsSurface organizationId="org-1" />);

    await user.type(await screen.findByLabelText("organizations.fields.website"), "openjii.org");

    expect(screen.getByText("organizations.errors.website")).toBeVisible();
    expect(screen.getByRole("button", { name: "common.save" })).toBeDisabled();
    expect(update()).not.toHaveBeenCalled();
  });

  it("submits a full URL exactly as typed", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountProfile({ role: "owner", website: null });
    server.mount(contract.organizations.listOrganizationResources, { body: { resources: [] } });

    render(<OrganizationSettingsSurface organizationId="org-1" />);

    await user.type(
      await screen.findByLabelText("organizations.fields.website"),
      "https://openjii.org/about",
    );
    await user.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(update()).toHaveBeenCalled();
    });
    // Stored verbatim: no trailing slash added, no scheme rewritten.
    expect(update().mock.calls[0]?.[0]).toMatchObject({
      data: { website: "https://openjii.org/about" },
    });
  });
});
