import { createOrganizationJoinRequest } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { OrganizationJoinRequest } from "@repo/api/domains/organization/join-requests/organization-join-requests.schema";
import { useSession } from "@repo/auth/client";

import { OrganizationJoinRequests } from "./organization-join-requests";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

function mountRequests(requests: OrganizationJoinRequest[]) {
  return server.mount(contract.organizations.listOrganizationJoinRequests, { body: requests });
}

function rowFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest('[role="listitem"]');
  if (!row) throw new Error(`No request row found for ${name}`);
  return row as HTMLElement;
}

describe("<OrganizationJoinRequests />", () => {
  afterEach(() => {
    mockSession(null);
  });

  it("distinguishes no requests at all from none waiting on a decision", async () => {
    mockSession({ id: "user-1" });
    mountRequests([]);

    const { unmount } = render(<OrganizationJoinRequests organizationId="org-1" />);
    expect(await screen.findByText("organizations.requests.emptyTitle")).toBeVisible();
    unmount();

    mountRequests([
      createOrganizationJoinRequest({
        status: "rejected",
        decidedAt: "2026-02-01T00:00:00.000Z",
        user: {
          id: "user-9",
          firstName: "Alan",
          lastName: "Turing",
          email: "alan@example.com",
          avatarUrl: null,
        },
      }),
    ]);

    render(<OrganizationJoinRequests organizationId="org-1" />);

    expect(await screen.findByText("organizations.requests.noPending")).toBeVisible();
    expect(screen.queryByText("organizations.requests.emptyTitle")).not.toBeInTheDocument();
  });

  it("offers a decision on a pending request and shows the message that came with it", async () => {
    mockSession({ id: "user-1" });
    mountRequests([
      createOrganizationJoinRequest({
        status: "pending",
        message: "I work on chlorophyll fluorescence",
        user: {
          id: "user-9",
          firstName: "Alan",
          lastName: "Turing",
          email: "alan@example.com",
          avatarUrl: null,
        },
      }),
    ]);

    render(<OrganizationJoinRequests organizationId="org-1" />);

    await screen.findByText("Alan Turing");
    const row = within(rowFor("Alan Turing"));
    expect(row.getByRole("button", { name: "organizations.requests.approveAction" })).toBeVisible();
    expect(row.getByRole("button", { name: "organizations.requests.rejectAction" })).toBeVisible();
    expect(row.getByText("I work on chlorophyll fluorescence")).toBeVisible();
  });

  it("shows a decided request as history, with no decision to make again", async () => {
    mockSession({ id: "user-1" });
    mountRequests([
      createOrganizationJoinRequest({
        status: "approved",
        decidedAt: "2026-02-01T00:00:00.000Z",
        user: {
          id: "user-9",
          firstName: "Alan",
          lastName: "Turing",
          email: "alan@example.com",
          avatarUrl: null,
        },
      }),
    ]);

    render(<OrganizationJoinRequests organizationId="org-1" />);

    expect(await screen.findByText("organizations.requests.historyTitle")).toBeVisible();
    expect(screen.getByText("organizations.requests.status.approved")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "organizations.requests.approveAction" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["organizations.requests.approveAction", "approve"],
    ["organizations.requests.rejectAction", "reject"],
  ] as const)("sends %s as the %s decision", async (label, decision) => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountRequests([
      createOrganizationJoinRequest({
        id: "00000000-0000-0000-0000-0000000000aa",
        status: "pending",
        user: {
          id: "user-9",
          firstName: "Alan",
          lastName: "Turing",
          email: "alan@example.com",
          avatarUrl: null,
        },
      }),
    ]);
    const decideSpy = server.mount(contract.organizations.decideOrganizationJoinRequest, {
      body: createOrganizationJoinRequest({ status: "approved" }),
    });

    render(<OrganizationJoinRequests organizationId="org-1" />);

    await user.click(await screen.findByRole("button", { name: label }));

    await waitFor(() => {
      expect(decideSpy.called).toBe(true);
    });
    expect(decideSpy.params).toMatchObject({
      id: "org-1",
      requestId: "00000000-0000-0000-0000-0000000000aa",
    });
    expect(decideSpy.body).toEqual({ decision });
  });
});
