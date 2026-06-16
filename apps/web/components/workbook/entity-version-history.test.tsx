import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { EntityVersionHistory } from "./entity-version-history";

const USER = "11111111-1111-1111-1111-111111111111";

describe("EntityVersionHistory", () => {
  it("opens the sheet and lists macro versions with usage", async () => {
    const user = userEvent.setup();
    server.mount(contract.macros.listMacroVersions, {
      body: [
        { version: 2, createdBy: USER, createdAt: "2024-01-02T00:00:00Z" },
        { version: 1, createdBy: USER, createdAt: "2024-01-01T00:00:00Z" },
      ],
    });
    server.mount(contract.macros.getMacroUsage, { body: { count: 3, workbooks: [] } });

    render(<EntityVersionHistory kind="macro" entityId="m-1" currentVersion={1} />);

    await user.click(screen.getByRole("button", { name: "Version history" }));

    await waitFor(() => expect(screen.getByText("v2")).toBeInTheDocument());
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText(/Used by/).textContent).toContain("3");
    expect(screen.getByRole("button", { name: /Duplicate as a new macro/ })).toBeInTheDocument();
  });

  it("shows an empty state when a protocol has no versions", async () => {
    const user = userEvent.setup();
    server.mount(contract.protocols.listProtocolVersions, { body: [] });
    server.mount(contract.protocols.getProtocolUsage, { body: { count: 0, workbooks: [] } });

    render(<EntityVersionHistory kind="protocol" entityId="p-1" />);

    await user.click(screen.getByRole("button", { name: "Version history" }));

    await waitFor(() => expect(screen.getByText("No versions yet")).toBeInTheDocument());
  });
});
