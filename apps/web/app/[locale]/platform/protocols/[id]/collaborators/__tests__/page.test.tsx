import { createProtocolDetail, createResourceGrant, readOnlyCapabilities } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { use } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { generateMetadata } from "../page";
import ProtocolCollaboratorsPage from "../protocol-collaborators-content";

vi.mock("@/lib/platform-metadata", () => ({
  buildProtocolMetadata: vi.fn(({ id, section }: { id: string; section: string }) => ({
    title: `${section}:${id}`,
  })),
}));

function renderPage() {
  return render(<ProtocolCollaboratorsPage params={Promise.resolve({ id: "proto-1" })} />);
}

describe("generateMetadata", () => {
  it("titles the route by its collaborators section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", id: "proto-1" }),
    });

    expect(metadata.title).toBe("collaborators:proto-1");
  });
});

describe("ProtocolCollaboratorsPage", () => {
  beforeEach(() => {
    vi.mocked(use).mockReturnValue({ id: "proto-1" });
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
  });

  it("shows the collaborators surface to someone who may share", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({ id: "proto-1" }),
    });
    server.mount(contract.sharing.listGrants, {
      body: [
        createResourceGrant({
          resourceType: "protocol",
          resourceId: "proto-1",
          grantee: {
            type: "user",
            displayName: "Lin Zhao",
            email: "lin@uni.edu",
            avatarUrl: null,
            memberCount: null,
          },
        }),
      ],
    });

    renderPage();

    await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /sharing.invite/ })).toBeInTheDocument();
  });

  it("gives a grantee below share only the leave card", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({
        id: "proto-1",
        capabilities: { ...readOnlyCapabilities, canLeave: true },
      }),
    });

    renderPage();

    await waitFor(() => expect(screen.getByText("sharing.yourAccessTitle")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /sharing.invite/ })).not.toBeInTheDocument();
  });

  it("sends a viewer with no sharing surface back to the protocol", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocolDetail({ id: "proto-1", capabilities: readOnlyCapabilities }),
    });

    const { container, router } = renderPage();

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/en-US/platform/protocols/proto-1"),
    );
    expect(container).toBeEmptyDOMElement();
  });
});
