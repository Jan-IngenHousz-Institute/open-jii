import { beforeEach, describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { OrganizationSwitcher } from "./organization-switcher";
import { render, screen, userEvent, waitFor } from "~/test/test-utils";

const useListOrganizations = vi.mocked(authClient.useListOrganizations);
const useActiveOrganization = vi.mocked(authClient.useActiveOrganization);
const setActive = vi.mocked(authClient.organization.setActive);

type OrgList = ReturnType<typeof authClient.useListOrganizations>;
type ActiveOrg = ReturnType<typeof authClient.useActiveOrganization>;

const org = (id: string, name: string) => ({ id, name, slug: name }) as never;

function mockOrgs(list: unknown[], activeId: string | null) {
  useListOrganizations.mockReturnValue({ data: list, isPending: false } as unknown as OrgList);
  useActiveOrganization.mockReturnValue({
    data: activeId ? list.find((o) => (o as { id: string }).id === activeId) : null,
    isPending: false,
  } as unknown as ActiveOrg);
}

describe("OrganizationSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing while organizations are loading", () => {
    useListOrganizations.mockReturnValue({ data: [], isPending: true } as unknown as OrgList);
    useActiveOrganization.mockReturnValue({ data: null, isPending: true } as unknown as ActiveOrg);
    const { container } = render(<OrganizationSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the user has no organizations", () => {
    mockOrgs([], null);
    const { container } = render(<OrganizationSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the active organization name", () => {
    mockOrgs([org("o1", "Ada's workspace"), org("o2", "Lab Org")], "o1");
    render(<OrganizationSwitcher />);
    expect(screen.getByRole("button", { name: "Switch organization" })).toHaveTextContent(
      "Ada's workspace",
    );
  });

  it("falls back to the first org name when none is active", () => {
    mockOrgs([org("o1", "Ada's workspace")], null);
    render(<OrganizationSwitcher />);
    expect(screen.getByRole("button", { name: "Switch organization" })).toHaveTextContent(
      "Ada's workspace",
    );
  });

  it("switches the active organization on selection", async () => {
    mockOrgs([org("o1", "Ada's workspace"), org("o2", "Lab Org")], "o1");
    render(<OrganizationSwitcher />);

    await userEvent.click(screen.getByRole("button", { name: "Switch organization" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Lab Org/ }));

    await waitFor(() => expect(setActive).toHaveBeenCalledWith({ organizationId: "o2" }));
  });

  it("does not switch when selecting the already-active organization", async () => {
    mockOrgs([org("o1", "Ada's workspace"), org("o2", "Lab Org")], "o1");
    render(<OrganizationSwitcher />);

    await userEvent.click(screen.getByRole("button", { name: "Switch organization" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Ada's workspace/ }));

    expect(setActive).not.toHaveBeenCalled();
  });
});
