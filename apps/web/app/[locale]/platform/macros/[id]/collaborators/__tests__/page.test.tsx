import { createMacroDetail, createResourceGrant, readOnlyCapabilities } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { use } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import MacroCollaboratorsPage from "../macro-collaborators-content";
import { generateMetadata } from "../page";

vi.mock("@/lib/platform-metadata", () => ({
  buildMacroMetadata: vi.fn(({ id, section }: { id: string; section: string }) => ({
    title: `${section}:${id}`,
  })),
}));

function renderPage() {
  return render(<MacroCollaboratorsPage params={Promise.resolve({ id: "macro-1" })} />);
}

describe("generateMetadata", () => {
  it("titles the route by its collaborators section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", id: "macro-1" }),
    });

    expect(metadata.title).toBe("collaborators:macro-1");
  });
});

describe("MacroCollaboratorsPage", () => {
  beforeEach(() => {
    vi.mocked(use).mockReturnValue({ id: "macro-1" });
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
  });

  it("shows the collaborators surface to someone who may share", async () => {
    server.mount(contract.macros.getMacro, { body: createMacroDetail({ id: "macro-1" }) });
    server.mount(contract.sharing.listGrants, {
      body: [
        createResourceGrant({
          resourceType: "macro",
          resourceId: "macro-1",
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

    const { router } = renderPage();

    await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /sharing.invite/ })).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("gives a grantee below share only the leave card, and never fetches the roster", async () => {
    server.mount(contract.macros.getMacro, {
      body: createMacroDetail({
        id: "macro-1",
        capabilities: { ...readOnlyCapabilities, canLeave: true },
      }),
    });
    const listSpy = server.mount(contract.sharing.listGrants, { body: [] });

    renderPage();

    await waitFor(() => expect(screen.getByText("sharing.yourAccessTitle")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /sharing.invite/ })).not.toBeInTheDocument();
    expect(listSpy.called).toBe(false);
  });

  it("tells a viewer with no sharing surface that the tab is closed to them", async () => {
    server.mount(contract.macros.getMacro, {
      body: createMacroDetail({ id: "macro-1", capabilities: readOnlyCapabilities }),
    });

    renderPage();

    expect(await screen.findByText("errors.noAccess.title.macro")).toBeInTheDocument();
  });
});
