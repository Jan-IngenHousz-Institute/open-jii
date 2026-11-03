import { createMyOrganization, createOrganizationResource } from "@/test/factories";
import { openOnUrl } from "@/test/list-request";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import * as nav from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { zTransferableResourceType } from "@repo/api/domains/sharing/transfer-org/sharing-transfer-org.schema";
import { useSession } from "@repo/auth/client";
import deCommon from "@repo/i18n/locales/de-DE/common.json";
import enCommon from "@repo/i18n/locales/en-US/common.json";
import nlCommon from "@repo/i18n/locales/nl-NL/common.json";

import { OrganizationResourceRows } from "./organization-resource-rows";

const ORG_PATH = "/en-US/platform/organizations/org-1";

/** Opens the Filter menu and the type filter's values inside it. */
async function openTypeFilter(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^common\.filter/u }));
  await user.click(screen.getByRole("option", { name: "organizations.resources.typeFilter" }));
  return screen.getByRole("listbox", { name: "organizations.resources.typeFilter" });
}

/** The rows, scoped to the render — the suite shares one jsdom document. */
function rowsIn(container: HTMLElement): HTMLElement[] {
  return within(container).queryAllByRole("listitem");
}

const rowNames = (container: HTMLElement) =>
  rowsIn(container).map((row) => row.querySelector("a")?.textContent);

/** A mixed estate: one of each type, distinct names and timestamps. */
function mixedEstate() {
  return [
    createOrganizationResource({
      type: "experiment",
      id: "e1",
      name: "Drought stress",
      description: "<p>Rain-out shelter, 12 plots</p>",
      status: "stale",
      updatedAt: "2026-05-01T00:00:00.000Z",
    }),
    createOrganizationResource({
      type: "protocol",
      id: "p1",
      name: "Dark adaptation",
      family: "minipar",
      updatedAt: "2026-04-01T00:00:00.000Z",
    }),
    createOrganizationResource({
      type: "macro",
      id: "m1",
      name: "Batch fit",
      language: "r",
      updatedAt: "2026-03-01T00:00:00.000Z",
    }),
    createOrganizationResource({
      type: "workbook",
      id: "w1",
      name: "Canopy synthesis",
      updatedAt: "2026-02-01T00:00:00.000Z",
    }),
    createOrganizationResource({
      type: "device",
      id: "d1",
      name: "Ambyte 04",
      deviceType: "ambyte",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }),
    createOrganizationResource({
      type: "device_group",
      id: "g1",
      name: "Rooftop array",
      memberCount: 12,
      updatedAt: "2025-12-01T00:00:00.000Z",
    }),
  ];
}

describe("<OrganizationResourceRows />", () => {
  it("renders one flat list, with no group headers or per-group counts", () => {
    const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

    // The grouped card put a heading and a count above each type. Both are gone; the
    // estate bar in the sidebar reports counts now.
    expect(within(container).queryAllByRole("heading")).toHaveLength(0);
    expect(rowsIn(container)).toHaveLength(6);
    // Default order is most recently updated first.
    expect(rowNames(container)).toEqual([
      "Drought stress",
      "Dark adaptation",
      "Batch fit",
      "Canopy synthesis",
      "Ambyte 04",
      "Rooftop array",
    ]);
  });

  it("has no status filter — it would only ever apply to experiments", async () => {
    const user = userEvent.setup();
    const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

    // One select, the sort, and one filter in the menu, the type.
    expect(within(container).getAllByRole("combobox")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "common.filter" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "organizations.resources.typeFilter",
    ]);
  });

  describe("search", () => {
    it("narrows by name as you type", async () => {
      const user = userEvent.setup();
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

      await user.type(
        within(container).getByRole("textbox", {
          name: "organizations.resources.searchLabel",
        }),
        "canopy",
      );

      expect(rowNames(container)).toEqual(["Canopy synthesis"]);
    });

    /**
     * Names only. "shelter" appears in the experiment's description and nowhere in any
     * name, so it must find nothing — the assertion that pins the decision rather than
     * one that would pass whichever field were searched.
     */
    it("does not match a word that appears only in a description", async () => {
      const user = userEvent.setup();
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

      await user.type(
        within(container).getByRole("textbox", {
          name: "organizations.resources.searchLabel",
        }),
        "shelter",
      );

      expect(rowsIn(container)).toHaveLength(0);
      expect(within(container).getByText("organizations.resources.noMatchesTitle")).toBeVisible();
    });
  });

  describe("the empty state", () => {
    it("offers no Clear filters for a search alone, which the search box clears", async () => {
      const user = userEvent.setup();
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

      await user.type(
        within(container).getByRole("textbox", {
          name: "organizations.resources.searchLabel",
        }),
        "nothing here is called this",
      );

      expect(rowsIn(container)).toHaveLength(0);
      expect(within(container).getByText("organizations.resources.noMatchesTitle")).toBeVisible();
      expect(within(container).queryByRole("button", { name: "common.clearFilters" })).toBeNull();
    });

    it("clears the type filter and keeps the search", async () => {
      openOnUrl(ORG_PATH, "type=device");
      const user = userEvent.setup();
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

      const search = within(container).getByRole("textbox", {
        name: "organizations.resources.searchLabel",
      });
      await user.type(search, "canopy");
      expect(rowsIn(container)).toHaveLength(0);

      // The chip row carries one too; this is the empty state's.
      const clears = within(container).getAllByRole("button", { name: "common.clearFilters" });
      await user.click(clears[clears.length - 1]);

      expect(rowNames(container)).toEqual(["Canopy synthesis"]);
      expect(search).toHaveValue("canopy");
    });

    it("says nothing about status, which this list does not filter on", async () => {
      const user = userEvent.setup();
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

      await user.type(
        within(container).getByRole("textbox", {
          name: "organizations.resources.searchLabel",
        }),
        "zzz",
      );

      // The design's own copy offered to "widen the type and status"; there is no status
      // control here, so promising one would send the reader looking for it.
      expect(within(container).queryByText(/status/iu)).toBeNull();
    });
  });

  describe("the type filter and sort controls", () => {
    /**
     * The ordering and narrowing logic is covered exhaustively in
     * `organization-resource-filter.test.ts`. What can only be checked here is that the
     * controls are wired to that logic and to the URL.
     */
    beforeEach(() => {
      openOnUrl(ORG_PATH, "");
      vi.mocked(nav.useRouter().replace).mockClear();
    });

    it("has no type dropdown of its own, only the Filter menu", () => {
      render(<OrganizationResourceRows resources={mixedEstate()} />);

      expect(screen.queryByRole("combobox", { name: /type/iu })).toBeNull();
      expect(screen.getByRole("button", { name: "common.filter" })).toBeInTheDocument();
    });

    it("offers one option per owned type, from the shared order", async () => {
      const user = userEvent.setup();
      render(<OrganizationResourceRows resources={mixedEstate()} />);

      const types = await openTypeFilter(user);

      // Seven types and no eighth, in GROUP_ORDER; a hand-written list could drift.
      expect(
        within(types)
          .getAllByRole("option")
          .map((o) => o.textContent),
      ).toEqual([
        "organizations.resources.types.experiment",
        "organizations.resources.types.protocol",
        "organizations.resources.types.macro",
        "organizations.resources.types.workbook",
        "organizations.resources.types.device",
        "organizations.resources.types.device_group",
        "organizations.resources.types.calibration_definition",
      ]);
    });

    it("narrows the list to the picked types and writes them to the URL", async () => {
      const user = userEvent.setup();
      const replace = vi.mocked(nav.useRouter().replace);
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

      const types = await openTypeFilter(user);
      await user.click(
        within(types).getByRole("option", { name: "organizations.resources.types.protocol" }),
      );
      await user.click(
        within(types).getByRole("option", { name: "organizations.resources.types.macro" }),
      );

      expect(rowNames(container)).toEqual(["Dark adaptation", "Batch fit"]);
      expect(replace).toHaveBeenLastCalledWith(`${ORG_PATH}?type=protocol,macro`, {
        scroll: false,
      });
    });

    it("shows a removable chip for each picked type and Clear filters only then", async () => {
      openOnUrl(ORG_PATH, "type=protocol");
      const user = userEvent.setup();
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

      expect(rowNames(container)).toEqual(["Dark adaptation"]);
      await user.click(screen.getByRole("button", { name: "common.clearFilters" }));

      expect(rowsIn(container)).toHaveLength(6);
      expect(screen.queryByRole("button", { name: "common.clearFilters" })).toBeNull();
    });

    it("opens on the type filter a shared link carries, dropping unknown types", () => {
      openOnUrl(ORG_PATH, "type=device,spaceship");
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

      expect(rowNames(container)).toEqual(["Ambyte 04"]);
    });

    it("reorders the list when a sort is chosen and writes it to the URL", async () => {
      const user = userEvent.setup();
      const replace = vi.mocked(nav.useRouter().replace);
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

      await user.click(
        within(container).getByRole("combobox", { name: "organizations.resources.sortLabel" }),
      );
      await user.click(
        await screen.findByRole("option", { name: "organizations.resources.sortName" }),
      );

      expect(rowNames(container)).toEqual([
        "Ambyte 04",
        "Batch fit",
        "Canopy synthesis",
        "Dark adaptation",
        "Drought stress",
        "Rooftop array",
      ]);
      // Commas stay raw in the written URL, the form people share.
      const sort = encodeURIComponent(
        JSON.stringify([{ field: "name", direction: "asc" }]),
      ).replace(/%2C/gu, ",");
      expect(replace).toHaveBeenLastCalledWith(`${ORG_PATH}?sort=${sort}`, { scroll: false });
    });

    it("opens on the sort a shared link carries, and on recent for one it cannot honour", () => {
      const sort = (value: unknown) => `sort=${encodeURIComponent(JSON.stringify(value))}`;

      openOnUrl(ORG_PATH, sort([{ field: "type", direction: "asc" }]));
      const { container, unmount } = render(<OrganizationResourceRows resources={mixedEstate()} />);
      expect(rowNames(container)[0]).toBe("Drought stress");
      expect(
        within(container).getByRole("combobox", { name: "organizations.resources.sortLabel" }),
      ).toHaveTextContent("organizations.resources.sortType");
      unmount();

      openOnUrl(ORG_PATH, sort([{ field: "name", direction: "desc" }]));
      const second = render(<OrganizationResourceRows resources={mixedEstate()} />);
      expect(
        within(second.container).getByRole("combobox", {
          name: "organizations.resources.sortLabel",
        }),
      ).toHaveTextContent("organizations.resources.sortRecent");
    });
  });

  describe("rows", () => {
    it("links each type to its own platform section", () => {
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);
      const href = (name: string) =>
        within(container).getByRole("link", { name }).getAttribute("href");

      expect(href("Drought stress")).toBe("/en-US/platform/experiments/e1");
      expect(href("Dark adaptation")).toBe("/en-US/platform/protocols/p1");
      expect(href("Batch fit")).toBe("/en-US/platform/macros/m1");
      expect(href("Canopy synthesis")).toBe("/en-US/platform/workbooks/w1");
      expect(href("Ambyte 04")).toBe("/en-US/platform/devices/d1");
      // Two segments, because a group's listing lives under the devices section.
      expect(href("Rooftop array")).toBe("/en-US/platform/devices/groups/g1");
    });

    it("carries each type's meta badge in the platform's own colour", () => {
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

      expect(within(container).getByText("organizations.resources.status.stale")).toHaveClass(
        "bg-status-stale",
      );
      // A language and a sensor family are product names, so neither is translated.
      expect(within(container).getByText("R")).toHaveClass("bg-status-stale");
      // A device wears the badge a protocol wears for the same value.
      expect(within(container).getByText("Ambyte")).toHaveClass("bg-status-active");
    });

    it("renders no meta badge for a workbook and no description for a device", () => {
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

      const rowFor = (name: string) => {
        const row = within(container).getByRole("link", { name }).closest("li");
        if (!row) throw new Error(`no row for ${name}`);
        return row;
      };

      // A workbook has no second fact worth a badge — and no empty badge either.
      expect(rowFor("Canopy synthesis").querySelector(".bg-status-stale")).toBeNull();
      // A device has no `description` column, so there must be no paragraph at all
      // rather than an empty one reserving a line on every device row.
      expect(rowFor("Ambyte 04").querySelector("p")).toBeNull();
      // Not vacuous: a row that does have a description renders one.
      expect(rowFor("Drought stress").querySelector("p")?.textContent).toBe(
        "Rain-out shelter, 12 plots",
      );
    });

    /**
     * A group's extra fact is a quantity, and the badge slot is for categorical values
     * that carry a colour from their own listing. So it has to be text in the footer,
     * and there has to be no badge — a numeric badge would be the first in the set and
     * would redefine what the slot means.
     */
    it("states a device group's roster size as footer text, with no badge", () => {
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

      const row = within(container).getByRole("link", { name: "Rooftop array" }).closest("li");
      if (!row) throw new Error("no row for Rooftop array");

      const roster = within(row).getByText("organizations.resources.groupMemberCount");
      expect(roster).toBeVisible();
      // Sits with the type dot, not in the badge slot: `Badge` is the only thing on a
      // row that renders as a `bg-*` pill, so no element here may be one.
      expect(row.querySelector('[class*="bg-status-"]')).toBeNull();
      expect(roster.tagName).toBe("SPAN");
      // Not vacuous: the same footer renders the type label right beside it.
      expect(within(row).getByText("organizations.resources.types.device_group")).toBeVisible();
    });

    it("strips markup out of a description rather than printing it", () => {
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

      expect(within(container).getByText("Rain-out shelter, 12 plots")).toBeVisible();
      expect(within(container).queryByText(/<p>/u)).toBeNull();
      expect(container.querySelector("p strong")).toBeNull();
    });

    it("keeps the timestamp machine-readable and the absolute date on the title", () => {
      const { container } = render(
        <OrganizationResourceRows
          resources={[
            createOrganizationResource({ name: "Campaign", updatedAt: "2026-05-01T00:00:00.000Z" }),
          ]}
        />,
      );

      const time = container.querySelector("time");
      expect(time).toHaveAttribute("dateTime", "2026-05-01T00:00:00.000Z");
      expect(time?.getAttribute("title")).toContain("common.updated");
    });

    it("marks a private row with the lock and leaves a public one unmarked", () => {
      const { container } = render(
        <OrganizationResourceRows
          resources={[
            createOrganizationResource({ id: "a", name: "Closed", visibility: "private" }),
            createOrganizationResource({ id: "b", name: "Open", visibility: "public" }),
          ]}
        />,
      );

      expect(within(container).getAllByLabelText("resourceVisibility.privateStatus")).toHaveLength(
        1,
      );
    });
  });

  it("carries no measurement count or sparkline — no data source for either", () => {
    const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

    expect(within(container).queryByText(/measurement/iu)).toBeNull();
    expect(container.querySelector("polyline")).toBeNull();
  });

  /**
   * The same affordance a resource carries on its own page, gated by one answer for the
   * whole page rather than by a capability on each row.
   */
  describe("the transfer control", () => {
    // The accessible name, which is the per-row `aria-label` rather than the visible text.
    const TRANSFER = "organizations.transfer.actionFor";

    const transferButtons = (container: HTMLElement) =>
      within(container).queryAllByRole("button", { name: TRANSFER });

    // `clearAllMocks` does not undo a `mockReturnValue`, and files share a module registry.
    afterEach(() => {
      vi.mocked(useSession).mockReturnValue({
        data: null,
        isPending: false,
      } as ReturnType<typeof useSession>);
    });

    /** The row a resource is on, so a click can be aimed at one of six. */
    function rowFor(container: HTMLElement, name: string): HTMLElement {
      const row = within(container).getByRole("link", { name }).closest("li");
      if (!row) throw new Error(`no row for ${name}`);
      return row;
    }

    function renderTransferable() {
      vi.mocked(useSession).mockReturnValue({
        data: { user: { id: "user-1" } },
        isPending: false,
      } as ReturnType<typeof useSession>);
      server.mount(contract.organizations.listMyOrganizations, {
        body: [createMyOrganization({ id: "org-2", name: "Other Lab" })],
      });
      return render(
        <OrganizationResourceRows
          resources={mixedEstate()}
          transfer={{ organizationId: "org-1" }}
        />,
      );
    }

    /**
     * Pinned on the enum, not the render: transferring a group would strand its devices
     * or force re-provisioning each one, so widening it must be a deliberate edit.
     */
    it("keeps devices and device groups out of the transferable set", () => {
      expect(zTransferableResourceType.options).toEqual([
        "experiment",
        "macro",
        "protocol",
        "workbook",
        "calibration_definition",
      ]);
    });

    it("offers nothing to a member or a non-member", () => {
      // Neither is handed `transfer`, so one render covers both.
      const { container } = render(<OrganizationResourceRows resources={mixedEstate()} />);

      expect(transferButtons(container)).toHaveLength(0);
    });

    it("offers it on the four transferable types and not on a device or a group", () => {
      const { container } = renderTransferable();

      // Six rows, four controls: neither a device nor a device group has a transfer
      // route, so neither gets a control that would only refuse.
      expect(rowsIn(container)).toHaveLength(6);
      expect(transferButtons(container)).toHaveLength(4);
      for (const name of ["Ambyte 04", "Rooftop array"]) {
        expect(
          within(rowFor(container, name)).queryByRole("button", { name: TRANSFER }),
        ).toBeNull();
      }
      for (const name of ["Drought stress", "Dark adaptation", "Batch fit", "Canopy synthesis"]) {
        expect(
          within(rowFor(container, name)).getByRole("button", { name: TRANSFER }),
        ).toBeVisible();
      }
    });

    it("opens one dialog, carrying the resource whose row was clicked", async () => {
      const user = userEvent.setup();
      const transferSpy = server.mount(contract.sharing.transferResourceOrganization, {
        body: { resourceType: "macro", resourceId: "m1", organizationId: "org-2" },
      });
      const { container } = renderTransferable();

      // Nothing mounted until a row asks for it.
      expect(screen.queryByRole("dialog")).toBeNull();

      await user.click(
        within(rowFor(container, "Batch fit")).getByRole("button", { name: TRANSFER }),
      );

      expect(await screen.findByText("organizations.transfer.dialogTitle")).toBeVisible();
      expect(screen.getAllByRole("dialog")).toHaveLength(1);

      await user.click(
        await screen.findByRole("combobox", { name: "organizations.transfer.targetLabel" }),
      );
      await user.click(screen.getByRole("option", { name: "Other Lab" }));
      await user.click(screen.getByRole("button", { name: "organizations.transfer.confirm" }));

      await waitFor(() => {
        expect(transferSpy.called).toBe(true);
      });
      // The macro that was clicked, not the first row and not another type.
      expect(transferSpy.params).toMatchObject({ resourceType: "macro", id: "m1" });
      expect(transferSpy.body).toEqual({ targetOrganizationId: "org-2" });
    });

    it("keeps the visible label short and names the row only for a screen reader", () => {
      const { container } = renderTransferable();

      const button = within(rowFor(container, "Batch fit")).getByRole("button", { name: TRANSFER });
      expect(button).toHaveTextContent("organizations.transfer.action");
    });

    /** The `t` stub returns the key, so the interpolation is asserted against the bundles. */
    it.each([
      ["en-US", enCommon],
      ["de-DE", deCommon],
      ["nl-NL", nlCommon],
    ])("%s names the resource in the accessible label", (_locale, bundle) => {
      expect(bundle.organizations.transfer.actionFor).toContain("{{name}}");
    });
  });
});
