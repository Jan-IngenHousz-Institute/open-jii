import { createSession, createUseSessionResult } from "@/test/factories";
import { server } from "@/test/msw/server";
import { TEST_LOCALES, mockRealTranslations } from "@/test/real-i18n";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";
import de from "@repo/i18n/locales/de-DE/common.json";
import en from "@repo/i18n/locales/en-US/common.json";
import nl from "@repo/i18n/locales/nl-NL/common.json";

import { PlatformAdmins } from "./platform-admins";

const actor = "74112d55-3362-4697-a7c6-9f75162b4fa2";
const other = "858416c1-d018-4cd0-9270-5c7c17bc1980";
const bundles = { "en-US": en, "nl-NL": nl, "de-DE": de };

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
      { id: actor, name: "Signed-in Admin", grantedAt: "2026-10-21T09:00:00.000Z" },
      { id: other, name: "Seeded Admin", grantedAt: null },
    ],
  });
}

describe.each(TEST_LOCALES)("<PlatformAdmins /> in %s", (locale) => {
  const copy = bundles[locale].platformAdmins;

  it("lists every admin with their grant date and id, and offers no way to change a role", async () => {
    await mockRealTranslations(locale);
    mountAdmins();
    render(<PlatformAdmins />);

    expect(await screen.findByText("Signed-in Admin")).toBeInTheDocument();
    expect(screen.getByText(copy.howGranted)).toBeInTheDocument();
    // Dates follow the route locale, which these renders leave at en-US.
    const date = new Date("2026-10-21T09:00:00.000Z").toLocaleDateString("en-US");
    expect(screen.getByText(copy.since.replace("{{date}}", date))).toBeInTheDocument();
    expect(screen.getByText(copy.dateUnknown)).toBeInTheDocument();
    expect(screen.getByText(other)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
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
    expect(await screen.findByText("Signed-in Admin")).toBeInTheDocument();
    expect(screen.queryByText(copy.loadFailed)).not.toBeInTheDocument();
  });

  it("shows a failed list with a retry action", async () => {
    await mockRealTranslations(locale);
    server.mount(contract.users.getPlatformAdminAccess, { body: { isPlatformAdmin: true } });
    server.mount(contract.users.listPlatformAdmins, { status: 500 });
    render(<PlatformAdmins />);

    expect(await screen.findByText(copy.loadFailed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.retry })).toBeInTheDocument();
    mountAdmins();
    await userEvent.click(screen.getByRole("button", { name: copy.retry }));
    expect(await screen.findByText("Signed-in Admin")).toBeInTheDocument();
    expect(screen.queryByText(copy.loadFailed)).not.toBeInTheDocument();
  });
});

it("redirects an ordinary researcher without displaying the list", async () => {
  server.mount(contract.users.getPlatformAdminAccess, { body: { isPlatformAdmin: false } });
  const { router } = render(<PlatformAdmins />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en-US/platform"));
  expect(screen.queryByRole("heading", { name: "platformAdmins.current" })).not.toBeInTheDocument();
});
