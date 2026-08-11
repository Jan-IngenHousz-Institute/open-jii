import { createResourceGrant, createWorkbookDetail, readOnlyCapabilities } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { use } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { generateMetadata } from "../page";
import WorkbookCollaboratorsPage from "../workbook-collaborators-content";

vi.mock("@/lib/platform-metadata", () => ({
  buildWorkbookMetadata: vi.fn(({ id, section }: { id: string; section: string }) => ({
    title: `${section}:${id}`,
  })),
}));

function renderPage() {
  return render(<WorkbookCollaboratorsPage params={Promise.resolve({ id: "wb-1" })} />);
}

describe("generateMetadata", () => {
  it("titles the route by its collaborators section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", id: "wb-1" }),
    });

    expect(metadata.title).toBe("collaborators:wb-1");
  });
});

describe("WorkbookCollaboratorsPage", () => {
  beforeEach(() => {
    vi.mocked(use).mockReturnValue({ id: "wb-1" });
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
  });

  it("shows the collaborators surface without any of the workbook's own chrome", async () => {
    server.mount(contract.workbooks.getWorkbook, { body: createWorkbookDetail({ id: "wb-1" }) });
    server.mount(contract.sharing.listGrants, {
      body: [
        createResourceGrant({
          resourceType: "workbook",
          resourceId: "wb-1",
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
    // The editor and the meta row's actions — fork, publish, delete — belong to the
    // Overview route.
    expect(screen.queryByText("workbooks.actions.fork")).not.toBeInTheDocument();
    expect(screen.queryByText("workbooks.actions.delete")).not.toBeInTheDocument();
  });

  it("gives a grantee below share only the leave card", async () => {
    server.mount(contract.workbooks.getWorkbook, {
      body: createWorkbookDetail({
        id: "wb-1",
        capabilities: { ...readOnlyCapabilities, canLeave: true },
      }),
    });

    renderPage();

    await waitFor(() => expect(screen.getByText("sharing.yourAccessTitle")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /sharing.invite/ })).not.toBeInTheDocument();
  });

  it("sends a viewer with no sharing surface back to the workbook", async () => {
    server.mount(contract.workbooks.getWorkbook, {
      body: createWorkbookDetail({ id: "wb-1", capabilities: readOnlyCapabilities }),
    });

    const { container, router } = renderPage();

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/en-US/platform/workbooks/wb-1"),
    );
    expect(container).toBeEmptyDOMElement();
  });
});
