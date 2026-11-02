import { createOrganizationDirectoryEntry } from "@/test/factories";
import { arrayParam, openOnUrl } from "@/test/list-request";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import * as nav from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { OrganizationDirectoryEntry } from "@repo/api/domains/organization/organization.schema";
import { useSession } from "@repo/auth/client";

import { ListOrganizations } from "./list-organizations";

const PATH = "/platform/organizations";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

function mountDirectory(organizations: OrganizationDirectoryEntry[]) {
  return server.mount(contract.organizations.listOrganizations, { body: { organizations } });
}

function rowFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest("tr");
  if (!row) throw new Error(`No organization row found for ${name}`);
  return row;
}

describe("<ListOrganizations />", () => {
  beforeEach(() => {
    openOnUrl(PATH, "");
    mockSession({ id: "user-1" });
  });
  afterEach(() => mockSession(null));

  it("labels the search box and offers no create action in the toolbar", () => {
    mountDirectory([]);

    render(<ListOrganizations />);

    // 224px clipped the placeholder's ellipsis.
    expect(screen.getByLabelText("organizations.searchLabel").closest("form")).toHaveClass(
      "md:w-64",
    );
    expect(screen.queryByRole("link", { name: "organizations.createAction" })).toBeNull();
  });

  it("renders membership-sensitive rows linking to the organization page", async () => {
    mountDirectory([
      createOrganizationDirectoryEntry({
        id: "private-org",
        name: "Private Lab",
        description: "Chlorophyll fluorescence at scale",
        type: "research_institute",
        visibility: "private",
        membershipStatus: "member",
        resourceCount: 7,
      }),
      createOrganizationDirectoryEntry({
        id: "public-org",
        name: "Public Lab",
        type: null,
        membershipStatus: "none",
        resourceCount: 3,
      }),
    ]);

    render(<ListOrganizations />);

    await screen.findByText("Private Lab");
    const mine = within(rowFor("Private Lab"));
    expect(mine.getByText("Chlorophyll fluorescence at scale")).toBeVisible();
    expect(mine.getByText("resourceVisibility.privateStatus")).toBeVisible();
    expect(mine.getByText("organizations.resourceCount")).toBeVisible();
    expect(mine.getByText("organizations.types.research_institute")).toBeVisible();
    expect(mine.getByRole("link", { name: "Private Lab" })).toHaveAttribute(
      "href",
      "/en-US/platform/organizations/private-org",
    );

    const other = within(rowFor("Public Lab"));
    expect(other.getByText("organizations.visibleResourceCount")).toBeVisible();
    expect(other.queryByText(/organizations\.types\./)).toBeNull();
  });

  it("offers the five organization types in order", async () => {
    const user = userEvent.setup();
    mountDirectory([]);

    render(<ListOrganizations />);
    await user.click(screen.getByRole("button", { name: /^common\.filter/ }));
    await user.click(screen.getByRole("option", { name: "organizations.fields.type" }));

    const types = screen.getByRole("listbox", { name: "organizations.fields.type" });
    expect(
      within(types)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "organizations.types.research_institute",
      "organizations.types.non_profit",
      "organizations.types.private_company",
      "organizations.types.government_agency",
      "organizations.types.university",
    ]);

    const replace = vi.mocked(nav.useRouter().replace);
    replace.mockClear();
    const spy = mountDirectory([]);
    await user.click(within(types).getByRole("option", { name: "organizations.types.university" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenLastCalledWith(`${PATH}?type=university`, { scroll: false });
    await waitFor(() =>
      expect(arrayParam(spy.calls.at(-1)?.url ?? "", "type")).toEqual(["university"]),
    );
    expect(
      screen.getByRole("group", {
        name: "organizations.fields.type common.filterIs organizations.types.university",
      }),
    ).toBeInTheDocument();
  });

  it("restores a shared search from q", async () => {
    openOnUrl(PATH, "q=lab");
    const spy = mountDirectory([]);

    render(<ListOrganizations />);

    expect(screen.getByLabelText("organizations.searchLabel")).toHaveValue("lab");
    await waitFor(() => expect(spy.calls.at(-1)?.query.search).toBe("lab"));
  });

  it.each([
    ["", "organizations.directory.emptyTitle"],
    ["q=nothing", "organizations.noMatches"],
    ["type=government_agency", "organizations.noFilterMatches"],
  ])("shows this resource's empty message on ?%s", async (qs, message) => {
    openOnUrl(PATH, qs);
    mountDirectory([]);

    render(<ListOrganizations />);

    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
