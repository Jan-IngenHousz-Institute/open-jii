import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { OrganizationJoinCta } from "./organization-join-cta";

/**
 * The join affordance lives on the organization's own header — the listing cards
 * are whole-card links and carry no buttons — so this is the only surface that
 * exercises the request and its withdrawal.
 */
describe("<OrganizationJoinCta />", () => {
  const props = { organizationId: "org-9", organizationName: "Greenhouse Lab" };

  it("sends the join request with the optional message", async () => {
    const user = userEvent.setup();
    const requestSpy = server.mount(contract.organizations.createOrganizationJoinRequest, {
      body: { id: "req-1" },
    });

    render(<OrganizationJoinCta {...props} membershipStatus="none" />);

    await user.click(screen.getByRole("button", { name: "organizations.join.requestAction" }));
    await user.type(
      screen.getByLabelText("organizations.join.messageLabel"),
      "  I work on chlorophyll fluorescence  ",
    );
    await user.click(screen.getByRole("button", { name: "organizations.join.submit" }));

    await waitFor(() => {
      expect(requestSpy.called).toBe(true);
    });
    expect(requestSpy.params).toMatchObject({ id: "org-9" });
    // Trimmed, because the surrounding whitespace is not part of the message.
    expect(requestSpy.body).toEqual({ message: "I work on chlorophyll fluorescence" });
  });

  it("sends no message at all when the box was left empty", async () => {
    const user = userEvent.setup();
    const requestSpy = server.mount(contract.organizations.createOrganizationJoinRequest, {
      body: { id: "req-1" },
    });

    render(<OrganizationJoinCta {...props} membershipStatus="none" />);

    await user.click(screen.getByRole("button", { name: "organizations.join.requestAction" }));
    await user.click(screen.getByRole("button", { name: "organizations.join.submit" }));

    await waitFor(() => {
      expect(requestSpy.called).toBe(true);
    });
    // An untouched box is no message, not an empty one.
    expect(requestSpy.body).toEqual({});
  });

  it("shows a pending request with a way to withdraw it", async () => {
    const user = userEvent.setup();
    const cancelSpy = server.mount(contract.organizations.cancelMyOrganizationJoinRequest, {
      body: { success: true },
    });

    render(<OrganizationJoinCta {...props} membershipStatus="pending_request" />);

    expect(screen.getByText("organizations.join.pending")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "organizations.join.requestAction" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "organizations.join.cancelAction" }));

    await waitFor(() => {
      expect(cancelSpy.called).toBe(true);
    });
    expect(cancelSpy.params).toMatchObject({ id: "org-9" });
  });

  it("offers a member nothing at all", () => {
    render(<OrganizationJoinCta {...props} membershipStatus="member" />);

    expect(
      screen.queryByRole("button", { name: "organizations.join.requestAction" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("organizations.join.pending")).not.toBeInTheDocument();
  });
});
