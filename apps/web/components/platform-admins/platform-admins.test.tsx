import { createSession, createUseSessionResult } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { beforeEach, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { authClient, useSession } from "@repo/auth/client";

import { PlatformAdmins } from "./platform-admins";

const actor = "74112d55-3362-4697-a7c6-9f75162b4fa2";
const target = "858416c1-d018-4cd0-9270-5c7c17bc1980";
beforeEach(() => {
  vi.mocked(useSession).mockReturnValue(
    createUseSessionResult({ data: createSession({ user: { id: actor } }), isPending: false }),
  );
});

it("shows configured/self protections and lets admins remove another appointed admin", async () => {
  server.mount(contract.users.getPlatformAdminAccess, { body: { isPlatformAdmin: true } });
  server.mount(contract.users.listPlatformAdmins, {
    body: [
      { id: actor, name: "Configured Admin", configured: true, appointedAt: null },
      {
        id: target,
        name: "Appointed Admin",
        configured: false,
        appointedAt: "2026-10-21T09:00:00.000Z",
      },
    ],
  });
  render(<PlatformAdmins />);
  await screen.findByText("Configured Admin");
  expect(screen.getAllByRole("button", { name: "platformAdmins.removeNamed" })).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: "platformAdmins.removeNamed" }));
  await waitFor(() =>
    expect(authClient.admin.setRole).toHaveBeenCalledWith({ userId: target, role: "user" }),
  );
});

it("redirects an ordinary researcher without displaying the list", async () => {
  server.mount(contract.users.getPlatformAdminAccess, { body: { isPlatformAdmin: false } });
  const { router } = render(<PlatformAdmins />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en-US/platform"));
  expect(screen.queryByRole("heading", { name: "platformAdmins.current" })).not.toBeInTheDocument();
});

it("renders a failed list with a retry action and an empty appointment search", async () => {
  server.mount(contract.users.getPlatformAdminAccess, { body: { isPlatformAdmin: true } });
  server.mount(contract.users.listPlatformAdmins, { status: 500 });
  server.mount(contract.users.searchPlatformAdminCandidates, { body: [] });
  render(<PlatformAdmins />);
  await screen.findByText("platformAdmins.loadFailed");
  expect(screen.getByRole("button", { name: "platformAdmins.retry" })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("platformAdmins.search"), "Nobody");
  await screen.findByText("platformAdmins.noResults");
});

it("explains when every matching researcher is already an admin", async () => {
  server.mount(contract.users.getPlatformAdminAccess, { body: { isPlatformAdmin: true } });
  server.mount(contract.users.listPlatformAdmins, {
    body: [{ id: actor, name: "Seed User", configured: true, appointedAt: null }],
  });
  server.mount(contract.users.searchPlatformAdminCandidates, {
    body: [{ id: actor, name: "Seed User" }],
  });
  render(<PlatformAdmins />);
  await screen.findByText("Seed User");
  await userEvent.type(screen.getByLabelText("platformAdmins.search"), "Seed");
  await screen.findByText("platformAdmins.alreadyAdmin");
});
