import { createSession, createUseSessionResult } from "@/test/factories";
import { server } from "@/test/msw/server";
import { TEST_LOCALES, mockRealTranslations } from "@/test/real-i18n";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { authClient, useSession } from "@repo/auth/client";
import de from "@repo/i18n/locales/de-DE/common.json";
import en from "@repo/i18n/locales/en-US/common.json";
import nl from "@repo/i18n/locales/nl-NL/common.json";

import { PlatformAdmins } from "./platform-admins";

const actor = "74112d55-3362-4697-a7c6-9f75162b4fa2";
const target = "858416c1-d018-4cd0-9270-5c7c17bc1980";
const bundles = { "en-US": en, "nl-NL": nl, "de-DE": de };

function named(template: string, name: string) {
  return template.replace("{{name}}", name);
}

beforeEach(() => {
  vi.mocked(useSession).mockReturnValue(
    createUseSessionResult({ data: createSession({ user: { id: actor } }), isPending: false }),
  );
});

afterEach(() => vi.restoreAllMocks());

function mountAdmins() {
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
}

describe.each(TEST_LOCALES)("<PlatformAdmins /> in %s", (locale) => {
  const copy = bundles[locale].platformAdmins;

  it("names each remove button and announces the outcome in a live region that was already there", async () => {
    await mockRealTranslations(locale);
    mountAdmins();
    render(<PlatformAdmins />);
    await screen.findByText("Configured Admin");

    // Configured admins and the signed-in admin carry no remove control.
    const remove = screen.getAllByRole("button", {
      name: named(copy.removeNamed, "Appointed Admin"),
    });
    expect(remove).toHaveLength(1);
    // The accessible name still contains the visible label, so voice control can say it.
    expect(remove[0].getAttribute("aria-label")).toContain(copy.remove);
    expect(remove[0]).toHaveTextContent(copy.remove);

    const liveRegions = screen.getAllByRole("status");
    const announcer = liveRegions.find((region) => region.getAttribute("aria-live") === "polite");
    expect(announcer).toBeDefined();

    await userEvent.click(remove[0]);
    await waitFor(() =>
      expect(authClient.admin.setRole).toHaveBeenCalledWith({ userId: target, role: "user" }),
    );
    await waitFor(() => expect(announcer).toHaveTextContent(copy.roleChanged_user));
    expect(screen.getAllByText(copy.roleChanged_user)).toHaveLength(1);
  });

  it("names each appoint button, searches once for the settled term and says when nobody is left", async () => {
    await mockRealTranslations(locale);
    mountAdmins();
    const search = server.mount(contract.users.searchPlatformAdminCandidates, {
      body: [
        { id: actor, name: "Configured Admin" },
        { id: "11111111-1111-4111-8111-111111111111", name: "Ada Lovelace" },
      ],
    });
    render(<PlatformAdmins />);
    await screen.findByText("Configured Admin");

    await userEvent.type(screen.getByLabelText(copy.search), "Ada");
    const appoint = await screen.findByRole("button", {
      name: named(copy.appointNamed, "Ada Lovelace"),
    });
    expect(appoint.getAttribute("aria-label")).toContain(copy.appoint);
    // One request for what was typed, not one per keystroke.
    expect(search.calls.map((call) => call.query.search)).toEqual(["Ada"]);

    await userEvent.click(appoint);
    await waitFor(() =>
      expect(authClient.admin.setRole).toHaveBeenCalledWith({
        userId: "11111111-1111-4111-8111-111111111111",
        role: "admin",
      }),
    );
    expect(await screen.findByText(copy.roleChanged_admin)).toBeInTheDocument();
  });

  it("says when every match is already an admin and when nobody matches", async () => {
    await mockRealTranslations(locale);
    mountAdmins();
    server.mount(contract.users.searchPlatformAdminCandidates, {
      body: [{ id: actor, name: "Configured Admin" }],
    });
    render(<PlatformAdmins />);
    await screen.findByText("Configured Admin");

    await userEvent.type(screen.getByLabelText(copy.search), "Conf");
    expect(await screen.findByText(copy.searchStatus_alreadyAdmin)).toBeInTheDocument();

    server.mount(contract.users.searchPlatformAdminCandidates, { body: [] });
    await userEvent.type(screen.getByLabelText(copy.search), "x");
    expect(await screen.findByText(copy.searchStatus_none)).toBeInTheDocument();
  });

  it("keeps the heading and retries a failed access check", async () => {
    await mockRealTranslations(locale);
    const access = server.mount(contract.users.getPlatformAdminAccess, { status: 500 });
    render(<PlatformAdmins />);
    expect(await screen.findByText(copy.loadFailed)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: copy.title })).toBeInTheDocument();
    expect(access.calls).toHaveLength(1);
    mountAdmins();
    await userEvent.click(screen.getByRole("button", { name: copy.retry }));
    expect(await screen.findByText("Configured Admin")).toBeInTheDocument();
    expect(screen.queryByText(copy.loadFailed)).not.toBeInTheDocument();
  });

  it("shows a failed list with a retry action", async () => {
    await mockRealTranslations(locale);
    server.mount(contract.users.getPlatformAdminAccess, { body: { isPlatformAdmin: true } });
    server.mount(contract.users.listPlatformAdmins, { status: 500 });
    render(<PlatformAdmins />);

    expect(await screen.findByText(copy.loadFailed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.retry })).toBeInTheDocument();
  });
});

it("redirects an ordinary researcher without displaying the list", async () => {
  server.mount(contract.users.getPlatformAdminAccess, { body: { isPlatformAdmin: false } });
  const { router } = render(<PlatformAdmins />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en-US/platform"));
  expect(screen.queryByRole("heading", { name: "platformAdmins.current" })).not.toBeInTheDocument();
});
