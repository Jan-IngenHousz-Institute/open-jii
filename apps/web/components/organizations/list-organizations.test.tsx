import { createOrganizationDirectoryEntry } from "@/test/factories";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import * as nav from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { OrganizationDirectoryEntry } from "@repo/api/domains/organization/organization.schema";
import { useSession } from "@repo/auth/client";

import { ListOrganizations } from "./list-organizations";

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
  afterEach(() => mockSession(null));

  it("requests one ownership-ranked directory instead of separate my/all slices", async () => {
    mockSession({ id: "user-1" });
    const spy = mountDirectory([
      createOrganizationDirectoryEntry({
        id: "mine",
        name: "My Lab",
        membershipStatus: "member",
      }),
      createOrganizationDirectoryEntry({ id: "other", name: "Open Lab" }),
    ]);

    render(<ListOrganizations />);

    await screen.findByText("My Lab");
    expect(screen.getByText("Open Lab")).toBeVisible();
    expect(spy.calls.at(-1)?.query.scope).toBe("all");
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("keeps route-wide create out of the collection toolbar", () => {
    mockSession({ id: "user-1" });
    mountDirectory([]);

    render(<ListOrganizations />);

    expect(screen.getByLabelText("organizations.searchLabel")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "organizations.createAction" })).toBeNull();
  });

  it("renders membership-sensitive table rows from the unified response", async () => {
    mockSession({ id: "user-1" });
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
    expect(screen.getByRole("table")).toBeInTheDocument();
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
    expect(other.queryByRole("button")).toBeNull();
    expect(other.queryByText(/organizations\.types\./)).toBeNull();
  });

  it("searches the unified directory server-side and exposes the real pending window", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    const spy = server.mount(contract.organizations.listOrganizations, {
      body: ({ query }: SpyCall) => ({
        organizations: query.search
          ? [createOrganizationDirectoryEntry({ name: "Coastal Station" })]
          : [createOrganizationDirectoryEntry({ name: "Greenhouse Lab" })],
      }),
    });

    render(<ListOrganizations />);

    await screen.findByText("Greenhouse Lab");
    const search = screen.getByLabelText("organizations.searchLabel");
    await user.type(search, "coastal");
    expect(search).toHaveAttribute("aria-busy", "true");

    await waitFor(() => expect(screen.getByText("Coastal Station")).toBeVisible());
    expect(spy.calls.at(-1)?.query).toMatchObject({ search: "coastal", scope: "all" });
    expect(search).not.toHaveAttribute("aria-busy");
  });

  it("distinguishes an empty directory from a search with no matches", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountDirectory([]);

    render(<ListOrganizations />);

    expect(await screen.findByText("organizations.directory.emptyTitle")).toBeVisible();
    await user.type(screen.getByLabelText("organizations.searchLabel"), "nothing");
    expect(await screen.findByText("organizations.noMatches")).toBeVisible();
  });

  it("keeps current cards visible while a new search request loads", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountDirectory([createOrganizationDirectoryEntry({ name: "Greenhouse Lab" })]);

    render(<ListOrganizations />);
    await screen.findByText("Greenhouse Lab");

    const searchSpy = server.mount(contract.organizations.listOrganizations, {
      body: { organizations: [] },
      delay: "infinite",
    });
    await user.type(screen.getByLabelText("organizations.searchLabel"), "green");
    await waitFor(() => expect(searchSpy.called).toBe(true));
    expect(screen.getByText("Greenhouse Lab")).toBeVisible();
  });

  it("paginates the ownership-ranked response without changing its order", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountDirectory(
      Array.from({ length: 21 }, (_, index) =>
        createOrganizationDirectoryEntry({
          id: `org-${index + 1}`,
          name: `Organization ${String(index + 1).padStart(2, "0")}`,
          membershipStatus: index < 2 ? "member" : "none",
        }),
      ),
    );

    render(<ListOrganizations />);

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Organization 01" })).toBeVisible(),
    );
    expect(screen.getByRole("link", { name: "Organization 20" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Organization 21" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "pagination.next" }));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Organization 21" })).toBeVisible(),
    );
    expect(screen.queryByRole("link", { name: "Organization 01" })).toBeNull();
  });

  it("keeps pagination visible and disabled when the directory has only one page", async () => {
    mockSession({ id: "user-1" });
    mountDirectory([createOrganizationDirectoryEntry({ name: "Single Lab" })]);

    render(<ListOrganizations />);

    await waitFor(() => expect(screen.getByRole("link", { name: "Single Lab" })).toBeVisible());
    expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
  });

  it("sorts the directory through the API before browser pagination", async () => {
    mockSession({ id: "user-1" });
    const spy = mountDirectory([
      createOrganizationDirectoryEntry({ id: "org-a", name: "Alpha" }),
      createOrganizationDirectoryEntry({ id: "org-b", name: "Bravo" }),
    ]);
    const user = userEvent.setup();
    render(<ListOrganizations />);

    await screen.findByText("Alpha");
    await user.click(screen.getByRole("button", { name: /organizations.fields.name:/ }));
    await waitFor(() => expect(spy.calls.at(-1)?.query["sort[0][field]"]).toBe("name"));
    expect(spy.calls.at(-1)?.query["sort[0][direction]"]).toBe("asc");
    expect(screen.getByRole("button", { name: "common.resetSorting" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "common.resetSorting" }));
    await waitFor(() => expect(spy.calls.at(-1)?.query.sort).toBeUndefined());
  });

  describe("type filter", () => {
    function openOnUrl(qs: string) {
      vi.mocked(nav.usePathname).mockReturnValue("/platform/organizations");
      vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams(qs));
    }

    it("offers the five types in order and hides Clear filters while nothing is picked", async () => {
      openOnUrl("");
      const user = userEvent.setup();
      mockSession({ id: "user-1" });
      mountDirectory([]);

      render(<ListOrganizations />);

      expect(screen.queryByRole("button", { name: "common.clearFilters" })).toBeNull();
      await user.click(screen.getByRole("button", { name: "organizations.fields.type" }));
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "organizations.types.research_institute",
        "organizations.types.non_profit",
        "organizations.types.private_company",
        "organizations.types.government_agency",
        "organizations.types.university",
      ]);
    });

    it("filters through the URL and the API", async () => {
      openOnUrl("");
      const user = userEvent.setup();
      mockSession({ id: "user-1" });
      const replace = vi.mocked(nav.useRouter().replace);
      replace.mockClear();
      const spy = mountDirectory([]);

      render(<ListOrganizations />);
      await user.click(screen.getByRole("button", { name: "organizations.fields.type" }));
      await user.click(screen.getByRole("option", { name: "organizations.types.university" }));

      expect(replace).toHaveBeenLastCalledWith("/platform/organizations?type=university", {
        scroll: false,
      });
      await waitFor(() => {
        expect(spy.calls.at(-1)?.url).toContain("type%5B0%5D=university");
      });
      expect(screen.getByRole("button", { name: /organizations\.fields\.type/ })).toHaveTextContent(
        "1",
      );
    });

    it("restores a shared filter and clears it without dropping the search", async () => {
      openOnUrl("q=lab&type=university,non_profit");
      const user = userEvent.setup();
      mockSession({ id: "user-1" });
      const replace = vi.mocked(nav.useRouter().replace);
      replace.mockClear();
      mountDirectory([createOrganizationDirectoryEntry({ name: "Northfield Lab" })]);

      render(<ListOrganizations />);

      expect(screen.getByRole("button", { name: /organizations\.fields\.type/ })).toHaveTextContent(
        "2",
      );
      expect(screen.getByLabelText("organizations.searchLabel")).toHaveValue("lab");
      await waitFor(() =>
        expect(screen.getByRole("link", { name: "Northfield Lab" })).toBeInTheDocument(),
      );

      await user.click(screen.getByRole("button", { name: "common.clearFilters" }));

      expect(replace).toHaveBeenLastCalledWith("/platform/organizations?q=lab", { scroll: false });
      expect(screen.queryByRole("button", { name: "common.clearFilters" })).toBeNull();
    });

    it("offers to clear the filter when nothing matches it", async () => {
      openOnUrl("type=government_agency");
      const user = userEvent.setup();
      mockSession({ id: "user-1" });
      server.mount(contract.organizations.listOrganizations, {
        body: ({ url }: SpyCall) => ({
          organizations: url.includes("type%5B0%5D")
            ? []
            : [createOrganizationDirectoryEntry({ name: "Greenhouse Lab" })],
        }),
      });

      render(<ListOrganizations />);

      await waitFor(() =>
        expect(screen.getByText("organizations.noFilterMatches")).toBeInTheDocument(),
      );
      const clearButtons = screen.getAllByRole("button", { name: "common.clearFilters" });
      expect(clearButtons).toHaveLength(2);

      await user.click(clearButtons[1]);

      await waitFor(() =>
        expect(screen.getByRole("link", { name: "Greenhouse Lab" })).toBeInTheDocument(),
      );
      expect(screen.queryByRole("button", { name: "common.clearFilters" })).toBeNull();
    });
  });

  // jsdom cannot measure text, so the width itself was set from a browser
  // measurement: the placeholder needs 151px and w-56 left only 146px.
  it("gives the search box room for its own placeholder", () => {
    render(<ListOrganizations />);
    const form = screen.getByPlaceholderText("organizations.searchPlaceholder").closest("form");
    expect(form).toHaveClass("md:w-64");
  });
});
