import { createResourceGrant } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { CollaboratorsAboutRow } from "./collaborators-about-row";

const props = {
  resourceType: "device" as const,
  resourceId: "33333333-3333-4333-8333-333333333333",
  href: "/en-US/platform/devices/33333333-3333-4333-8333-333333333333/collaborators",
};

describe("CollaboratorsAboutRow", () => {
  it("shows the people with access as a trail with a count in words", async () => {
    server.mount(contract.sharing.listGrants, {
      body: [
        createResourceGrant({
          grantee: { ...createResourceGrant().grantee, displayName: "Ada L" },
        }),
        createResourceGrant({
          grantee: {
            type: "user",
            displayName: null,
            email: "no-name@x.io",
            avatarUrl: null,
            memberCount: null,
          },
        }),
      ],
    });

    render(<CollaboratorsAboutRow {...props} enabled />);

    expect(await screen.findByText("sharing.collaboratorCount:2")).toBeInTheDocument();
    expect(screen.getByText("sharing.cardTitle")).toBeInTheDocument();
  });

  it("never fires the grant read for a viewer who cannot share", () => {
    const spy = server.mount(contract.sharing.listGrants, { body: [] });

    const { container } = render(<CollaboratorsAboutRow {...props} enabled={false} />);

    expect(container).toBeEmptyDOMElement();
    expect(spy.called).toBe(false);
  });

  it("is absent rather than broken when the grant read fails", async () => {
    server.mount(contract.sharing.listGrants, { status: 500 });

    const { container } = render(<CollaboratorsAboutRow {...props} enabled />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("is absent when nobody holds a grant", async () => {
    server.mount(contract.sharing.listGrants, { body: [] });

    const { container } = render(<CollaboratorsAboutRow {...props} enabled />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
