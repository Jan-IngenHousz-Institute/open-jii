import { createOrganizationDirectoryEntry } from "@/test/factories";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
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
        visibility: "private",
        membershipStatus: "member",
        resourceCount: 7,
      }),
      createOrganizationDirectoryEntry({
        id: "public-org",
        name: "Public Lab",
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
    expect(mine.getByRole("link", { name: "Private Lab" })).toHaveAttribute(
      "href",
      "/en-US/platform/organizations/private-org",
    );

    const other = within(rowFor("Public Lab"));
    expect(other.getByText("organizations.visibleResourceCount")).toBeVisible();
    expect(other.queryByRole("button")).toBeNull();
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
});
