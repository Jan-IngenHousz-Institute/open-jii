import { createOrganizationDirectoryEntry } from "@/test/factories";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { OrganizationDirectoryEntry } from "@repo/api/domains/organization/organization.schema";
import { useSession } from "@repo/auth/client";

import { ListOrganizations } from "./list-organizations";

/** Point the globally-mocked `useSession` at a given principal. */
function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

/**
 * Land on the directory the way a link into it does — the filter is URL state, so
 * this is the same entry point as the sidebar's "Organization directory".
 */
function landOnDirectory() {
  vi.mocked(useSearchParams).mockReturnValue(new ReadonlyURLSearchParams("filter=all"));
}

function mountDirectory(organizations: OrganizationDirectoryEntry[]) {
  return server.mount(contract.organizations.listOrganizations, { body: { organizations } });
}

/**
 * The "my organizations" slice. It is the *same* endpoint as the directory with
 * `scope=related`, not a second one — so these mount the directory too, and rows carry
 * `membershipStatus: "member"` because that is what the caller's own organizations
 * come back as.
 */
function mountMine(organizations: Partial<OrganizationDirectoryEntry>[]) {
  return mountDirectory(
    organizations.map((organization) =>
      createOrganizationDirectoryEntry({ membershipStatus: "member", ...organization }),
    ),
  );
}

/** The card for an organization — the whole card is the link to it. */
function cardFor(name: string): HTMLElement {
  const card = screen.getByText(name).closest("a");
  if (!card) throw new Error(`No organization card found for ${name}`);
  return card;
}

describe("<ListOrganizations />", () => {
  afterEach(() => {
    mockSession(null);
  });

  describe("my organizations", () => {
    it("lands on the caller's own organizations, asking the directory for that slice", async () => {
      mockSession({ id: "user-1" });
      // Personal workspaces are excluded server-side now, so there is nothing to filter
      // out here — what this has to prove instead is that the slice is requested at all.
      const spy = mountMine([{ id: "org-1", name: "Greenhouse Lab", memberCount: 4 }]);

      render(<ListOrganizations />);

      await screen.findByText("Greenhouse Lab");
      expect(spy.calls.at(-1)?.query.scope).toBe("related");
    });

    it("shows the card's description, count pills and visibility on a private organization", async () => {
      mockSession({ id: "user-1" });
      mountMine([
        {
          id: "org-7",
          name: "Greenhouse Lab",
          description: "Chlorophyll fluorescence at scale",
          visibility: "private",
        },
      ]);

      render(<ListOrganizations />);

      await screen.findByText("Greenhouse Lab");
      const card = cardFor("Greenhouse Lab");
      // The whole card is the link, as on the experiment and macro cards.
      expect(card).toHaveAttribute("href", "/en-US/platform/organizations/org-7");

      const within_ = within(card);
      expect(within_.getByText("Chlorophyll fluorescence at scale")).toBeVisible();
      expect(within_.getByText("organizations.memberCount")).toBeVisible();
      expect(within_.getByText("organizations.resourceCount")).toBeVisible();
      expect(within_.getByText("resourceVisibility.privateStatus")).toBeVisible();
    });

    /**
     * A plain-text description used to render untruncated while the identical call on
     * the experiment cards clamped — the renderer applied `truncate` only on its
     * rich-text branch. Asserting the clamp itself, not that the text is present: the
     * test above says the text is present and stayed green throughout.
     */
    it("clamps a plain-text description, which does not arrive with markup", async () => {
      mockSession({ id: "user-1" });
      mountMine([
        {
          name: "Greenhouse Lab",
          description:
            "A field group studying canopy photosynthesis across three continents, " +
            "with a long enough profile to run past three lines in a card column.",
        },
      ]);

      render(<ListOrganizations />);

      await screen.findByText("Greenhouse Lab");
      const description = within(cardFor("Greenhouse Lab")).getByText(/A field group studying/u);
      expect(description.style.display).toBe("-webkit-box");
      expect(description.style.overflow).toBe("hidden");
      // Two, like the experiment, macro and protocol listing cards — this card is not
      // the one that gets to be different.
      expect(description.style.getPropertyValue("-webkit-line-clamp")).toBe("2");
    });

    it("falls back to the shared placeholder when an organization has no description", async () => {
      mockSession({ id: "user-1" });
      mountMine([{ name: "Greenhouse Lab", description: null }]);

      render(<ListOrganizations />);

      await screen.findByText("Greenhouse Lab");
      expect(within(cardFor("Greenhouse Lab")).getByText("No description provided")).toBeVisible();
    });

    /** The my-organizations branch is all memberships, so always the plain label. */
    it("labels the resource count plainly, since every row here is one you belong to", async () => {
      mockSession({ id: "user-1" });
      mountMine([{ name: "Greenhouse Lab", resourceCount: 7 }]);

      render(<ListOrganizations />);

      await screen.findByText("Greenhouse Lab");
      const card = within(cardFor("Greenhouse Lab"));
      expect(card.getByText("organizations.resourceCount")).toBeVisible();
      expect(card.queryByText("organizations.visibleResourceCount")).toBeNull();
    });

    it("carries no membership badge or in-card action", async () => {
      mockSession({ id: "user-1" });
      mountMine([{ name: "Greenhouse Lab" }]);

      render(<ListOrganizations />);

      await screen.findByText("Greenhouse Lab");
      const card = within(cardFor("Greenhouse Lab"));
      expect(card.queryByText("organizations.roles.owner")).not.toBeInTheDocument();
      expect(card.queryByRole("button")).not.toBeInTheDocument();
    });

    it("leaves the visibility badge off a listed organization", async () => {
      mockSession({ id: "user-1" });
      mountMine([{ name: "Greenhouse Lab", visibility: "public" }]);

      render(<ListOrganizations />);

      await screen.findByText("Greenhouse Lab");
      const card = within(cardFor("Greenhouse Lab"));
      expect(card.queryByText("resourceVisibility.privateStatus")).not.toBeInTheDocument();
      expect(card.queryByText("resourceVisibility.publicStatus")).not.toBeInTheDocument();
    });

    /**
     * Searching "mine" is a server round trip carrying `scope=related`, not a substring
     * test in the browser. That is the whole point of the change: the memberships used to
     * be filtered client-side on name and description only, so a location or type match —
     * or a stemmed or misspelled term — found rows under "all" and nothing under "my".
     * Answering off the query proves the term reaches the server with the slice intact.
     */
    it("searches its own slice server-side, carrying the term and the scope", async () => {
      const user = userEvent.setup();
      mockSession({ id: "user-1" });
      const spy = server.mount(contract.organizations.listOrganizations, {
        body: ({ query }: SpyCall) => ({
          organizations: query.search
            ? [createOrganizationDirectoryEntry({ name: "Coastal Station" })]
            : [
                createOrganizationDirectoryEntry({ name: "Greenhouse Lab" }),
                createOrganizationDirectoryEntry({ name: "Coastal Station" }),
              ],
        }),
      });

      render(<ListOrganizations />);

      await screen.findByText("Greenhouse Lab");
      await user.type(screen.getByLabelText("organizations.searchLabel"), "coastal");

      // The term is debounced, so the narrowing lands a moment after the keystrokes.
      await waitFor(() => {
        expect(screen.queryByText("Greenhouse Lab")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Coastal Station")).toBeVisible();
      expect(spy.calls.at(-1)?.query).toMatchObject({ search: "coastal", scope: "related" });
    });

    it("offers the empty state a way to create the first organization", async () => {
      mockSession({ id: "user-1" });
      mountMine([]);

      render(<ListOrganizations />);

      expect(await screen.findByText("organizations.mine.emptyTitle")).toBeVisible();
      expect(screen.getByRole("link", { name: "organizations.createAction" })).toHaveAttribute(
        "href",
        "/en-US/platform/organizations/new",
      );
    });

    it("switches to the directory from the filter, without leaving the route", async () => {
      const user = userEvent.setup();
      mockSession({ id: "user-1" });
      // One endpoint answering both slices off `scope` — the filter changes the query,
      // not which endpoint is called.
      const directorySpy = server.mount(contract.organizations.listOrganizations, {
        body: ({ query }: SpyCall) => ({
          organizations: [
            createOrganizationDirectoryEntry({
              name: query.scope === "related" ? "Greenhouse Lab" : "Coastal Station",
            }),
          ],
        }),
      });

      render(<ListOrganizations />);

      await screen.findByText("Greenhouse Lab");
      // Addressed by name, not just by role: without an explicit label the trigger's
      // accessible name is whichever option is selected, so it announces "My
      // organizations" and never says what it filters. Naming it here is what keeps
      // that label from being dropped again.
      await user.click(screen.getByRole("combobox", { name: "organizations.filter.label" }));
      await user.click(screen.getByRole("option", { name: "organizations.filter.all" }));

      await waitFor(() => {
        expect(directorySpy.calls.at(-1)?.query.scope).toBe("all");
      });
      expect(await screen.findByText("Coastal Station")).toBeVisible();
    });

    /**
     * Held-over rows are right for a new search term — it narrows the set already on
     * screen — and wrong across a scope change, where the two slices are different sets.
     * Without the guard the directory's rows render under "My organizations", counts and
     * all, for as long as the related request is in flight.
     */
    it("does not show the other scope's rows while the switch is in flight", async () => {
      const user = userEvent.setup();
      mockSession({ id: "user-1" });
      vi.mocked(useSearchParams).mockReturnValue(new ReadonlyURLSearchParams("filter=all"));
      mountDirectory([createOrganizationDirectoryEntry({ name: "Somebody Elses Lab" })]);

      render(<ListOrganizations />);
      await screen.findByText("Somebody Elses Lab");

      // Hangs, so the switch stays mid-flight for the whole assertion.
      server.mount(contract.organizations.listOrganizations, {
        body: { organizations: [] },
        delay: "infinite",
      });
      await user.click(screen.getByRole("combobox", { name: "organizations.filter.label" }));
      await user.click(screen.getByRole("option", { name: "organizations.filter.my" }));

      await waitFor(() => {
        expect(screen.queryByText("Somebody Elses Lab")).not.toBeInTheDocument();
      });
    });
  });

  describe("the directory", () => {
    it("links the whole card to the organization and offers no in-card action", async () => {
      mockSession({ id: "user-1" });
      landOnDirectory();
      mountDirectory([
        createOrganizationDirectoryEntry({
          id: "org-9",
          name: "Greenhouse Lab",
          membershipStatus: "none",
        }),
      ]);

      render(<ListOrganizations />);

      await screen.findByText("Greenhouse Lab");
      const card = cardFor("Greenhouse Lab");
      expect(card).toHaveAttribute("href", "/en-US/platform/organizations/org-9");
      // Asking to join is the organization header's affordance; the card is a link,
      // exactly like the experiment and macro cards.
      expect(within(card).queryByRole("button")).not.toBeInTheDocument();
    });

    it("counts members and owned resources on every card", async () => {
      mockSession({ id: "user-1" });
      landOnDirectory();
      mountDirectory([
        createOrganizationDirectoryEntry({
          name: "Greenhouse Lab",
          memberCount: 4,
          resourceCount: 12,
        }),
      ]);

      render(<ListOrganizations />);

      await screen.findByText("Greenhouse Lab");
      const card = within(cardFor("Greenhouse Lab"));
      expect(card.getByText("organizations.memberCount")).toBeVisible();
      // The factory defaults to `membershipStatus: "none"`, so the count is qualified.
      expect(card.getByText("organizations.visibleResourceCount")).toBeVisible();
    });

    it("distinguishes an empty directory from one with no matches", async () => {
      const user = userEvent.setup();
      mockSession({ id: "user-1" });
      landOnDirectory();
      mountDirectory([]);

      render(<ListOrganizations />);

      expect(await screen.findByText("organizations.directory.emptyTitle")).toBeVisible();

      await user.type(screen.getByLabelText("organizations.searchLabel"), "nothing");

      expect(await screen.findByText("organizations.noMatches")).toBeVisible();
    });

    it("renders every organization at once, with no pager", async () => {
      mockSession({ id: "user-1" });
      landOnDirectory();
      mountDirectory(
        ["Alpha Org", "Beta Org", "Gamma Org"].map((name) =>
          createOrganizationDirectoryEntry({ name }),
        ),
      );

      render(<ListOrganizations />);

      await screen.findByText("Alpha Org");
      expect(screen.getByText("Beta Org")).toBeVisible();
      expect(screen.getByText("Gamma Org")).toBeVisible();
      // The only listing of organizations there is, so it shows all of them.
      expect(screen.queryByRole("button", { name: /previous|next/iu })).toBeNull();
    });

    it("badges a private organization the caller belongs to", async () => {
      mockSession({ id: "user-1" });
      landOnDirectory();
      // "All organizations" now includes the caller's own private ones, so the row's
      // visibility has to come from the row — hardcoding "public" would strip the badge
      // and present a private organization as a listed one.
      mountDirectory([
        createOrganizationDirectoryEntry({
          name: "Secret Lab",
          visibility: "private",
          membershipStatus: "member",
        }),
        createOrganizationDirectoryEntry({ name: "Open Lab", visibility: "public" }),
      ]);

      render(<ListOrganizations />);

      await screen.findByText("Secret Lab");
      expect(
        within(cardFor("Secret Lab")).getByText("resourceVisibility.privateStatus"),
      ).toBeVisible();
      // Public is the unremarkable default and carries no badge.
      expect(
        within(cardFor("Open Lab")).queryByText("resourceVisibility.privateStatus"),
      ).toBeNull();
    });

    it("keeps the current cards on screen while a new search term loads", async () => {
      const user = userEvent.setup();
      mockSession({ id: "user-1" });
      landOnDirectory();
      mountDirectory([
        createOrganizationDirectoryEntry({ name: "Greenhouse Lab", membershipStatus: "none" }),
      ]);

      render(<ListOrganizations />);

      await screen.findByText("Greenhouse Lab");

      // A new term is a new cache key. Without the previous data held in place the list
      // drops to its pending state and unmounts every card, so the reader watches the
      // page they were reading disappear on every keystroke.
      const searchSpy = server.mount(contract.organizations.listOrganizations, {
        body: { organizations: [] },
        delay: "infinite",
      });
      await user.type(screen.getByLabelText("organizations.searchLabel"), "green");

      // Waited for the *request*, not the keystroke: the term is debounced, so the cache
      // key does not change until it settles, and asserting earlier would pass either way.
      await waitFor(() => {
        expect(searchSpy.called).toBe(true);
      });
      expect(screen.getByText("Greenhouse Lab")).toBeVisible();
    });
  });

  describe("the scoped resource-count label", () => {
    /** Membership decides the wording. `pending_request` is not membership. */
    it.each([
      ["member", "organizations.resourceCount", "organizations.visibleResourceCount"],
      ["none", "organizations.visibleResourceCount", "organizations.resourceCount"],
      ["pending_request", "organizations.visibleResourceCount", "organizations.resourceCount"],
    ] as const)("a %s row uses %s", async (membershipStatus, shown, hidden) => {
      mockSession({ id: "user-1" });
      landOnDirectory();
      mountDirectory([
        createOrganizationDirectoryEntry({
          name: "Photosynthesis Lab",
          resourceCount: 3,
          membershipStatus,
        }),
      ]);

      render(<ListOrganizations />);

      await screen.findByText("Photosynthesis Lab");
      const card = within(cardFor("Photosynthesis Lab"));
      expect(card.getByText(shown)).toBeVisible();
      expect(card.queryByText(hidden)).toBeNull();
    });

    it("shows no denominator and never says public", async () => {
      mockSession({ id: "user-1" });
      landOnDirectory();
      mountDirectory([
        createOrganizationDirectoryEntry({
          name: "Photosynthesis Lab",
          resourceCount: 3,
          membershipStatus: "none",
        }),
      ]);

      render(<ListOrganizations />);

      await screen.findByText("Photosynthesis Lab");
      // No denominator (that gap is the private estate's size) and not "public".
      const card = cardFor("Photosynthesis Lab");
      expect(card.textContent).not.toMatch(/\bof\b|43/u);
      expect(card.textContent).not.toMatch(/public/iu);
    });
  });
});
