import { createMyOrganization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { MyOrganization } from "@repo/api/domains/organization/organization.schema";
import { useSession } from "@repo/auth/client";

import { OrganizationPicker } from "./organization-picker";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

function mountMyOrganizations(organizations: MyOrganization[]) {
  return server.mount(contract.organizations.listMyOrganizations, { body: organizations });
}

const personal = createMyOrganization({
  id: "org-personal",
  name: "Ada's workspace",
  isPersonal: true,
  role: "owner",
});

describe("<OrganizationPicker />", () => {
  afterEach(() => {
    mockSession(null);
  });

  it("renders nothing when the caller has only their personal workspace", async () => {
    mockSession({ id: "user-1" });
    const spy = mountMyOrganizations([personal]);

    const { container } = render(<OrganizationPicker value={undefined} onChange={vi.fn()} />);

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
    // A picker with one unchangeable option presents a decision that does not exist.
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("defaults to the personal workspace under a generic label", async () => {
    mockSession({ id: "user-1" });
    mountMyOrganizations([
      personal,
      createMyOrganization({ id: "org-lab", name: "Greenhouse Lab" }),
    ]);

    render(<OrganizationPicker value={undefined} onChange={vi.fn()} />);

    const trigger = await screen.findByRole("combobox", { name: "organizations.picker.label" });
    // "Personal" rather than the workspace's own generated name, which is not a
    // name anyone chose.
    expect(trigger).toHaveTextContent("organizations.picker.personal");
    expect(trigger).not.toHaveTextContent("Ada's workspace");
  });

  it("offers the caller's organizations alongside the personal default", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountMyOrganizations([
      personal,
      createMyOrganization({ id: "org-lab", name: "Greenhouse Lab" }),
      createMyOrganization({ id: "org-inst", name: "Jan IngenHousz Institute" }),
    ]);

    render(<OrganizationPicker value={undefined} onChange={vi.fn()} />);

    await user.click(await screen.findByRole("combobox", { name: "organizations.picker.label" }));
    const options = within(screen.getByRole("listbox")).getAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "organizations.picker.personal",
      "Greenhouse Lab",
      "Jan IngenHousz Institute",
    ]);
  });

  it("reports the chosen organization's id to its host", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountMyOrganizations([
      personal,
      createMyOrganization({ id: "org-lab", name: "Greenhouse Lab" }),
    ]);
    const onChange = vi.fn();

    render(<OrganizationPicker value={undefined} onChange={onChange} />);

    await user.click(await screen.findByRole("combobox", { name: "organizations.picker.label" }));
    await user.click(screen.getByRole("option", { name: "Greenhouse Lab" }));

    expect(onChange).toHaveBeenCalledWith("org-lab");
  });
});
