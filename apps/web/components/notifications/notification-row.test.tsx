import { render, screen, within } from "@/test/test-utils";
import { I18nextProvider, useTranslation } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Notification } from "@repo/api/domains/notification/notification.schema";
import * as translations from "@repo/i18n";

import english from "../../../../packages/i18n/locales/en-US/notifications.json";
import { NotificationRow } from "./notification-row";

const ORGANIZATION_ID = "00000000-0000-4000-8000-0000000000bb";

function moved(organizationKind: string): Notification {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    type: "resource_moved_organization",
    category: "experiments_and_resources",
    actor: { id: "00000000-0000-4000-8000-0000000000aa", name: "Ada Lovelace" },
    resource: { type: "macro", id: "00000000-0000-4000-8000-0000000000bb" },
    params: { resourceName: "Leaf Spectra", organizationName: "Ada's workspace", organizationKind },
    readAt: null,
    createdAt: "2026-10-19T09:00:00.000Z",
  };
}

function aboutOrganization(
  type: Notification["type"],
  params: Record<string, string>,
): Notification {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    type,
    category: "membership_and_access",
    actor: { id: "00000000-0000-4000-8000-0000000000aa", name: "Ada Lovelace" },
    resource: { type: "organization", id: ORGANIZATION_ID },
    params: { organizationName: "Photosynthesis Lab", ...params },
    readAt: null,
    createdAt: "2026-10-20T09:00:00.000Z",
  };
}

function passkeyAdded(params: Record<string, string>): Notification {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    type: "passkey_added",
    category: "account_security",
    actor: null,
    resource: null,
    params,
    readAt: null,
    createdAt: "2026-10-27T09:00:00.000Z",
  };
}

async function renderRow(notification: Notification) {
  const { createInstance } = await vi.importActual<typeof translations>("@repo/i18n");
  const i18n = createInstance();
  await i18n.init({
    lng: "en-US",
    defaultNS: "notifications",
    resources: { "en-US": { notifications: english } },
    interpolation: { escapeValue: false },
  });
  vi.spyOn(translations, "useTranslation").mockImplementation(
    (ns = "notifications", options = {}) => useTranslation(ns, options),
  );
  return render(
    <I18nextProvider i18n={i18n}>
      <NotificationRow notification={notification} onOpen={vi.fn()} />
    </I18nextProvider>,
  );
}

describe("NotificationRow", () => {
  afterEach(() => vi.restoreAllMocks());

  it("says a move into a personal workspace went to their personal workspace", async () => {
    await renderRow(moved("personal"));

    expect(
      screen.getByText("Ada Lovelace moved Leaf Spectra to their personal workspace"),
    ).toBeInTheDocument();
  });

  it("calls an actor with no name Someone rather than leaving a blank", async () => {
    await renderRow({
      ...moved("personal"),
      actor: { id: "00000000-0000-4000-8000-0000000000aa", name: " " },
    });

    expect(
      screen.getByText("Someone moved Leaf Spectra to their personal workspace"),
    ).toBeInTheDocument();
  });

  it("names the organization a resource moved into", async () => {
    await renderRow({
      ...moved("organization"),
      params: {
        resourceName: "Leaf Spectra",
        organizationName: "Field Station North",
        organizationKind: "organization",
      },
    });

    expect(
      screen.getByText("Ada Lovelace moved Leaf Spectra to Field Station North"),
    ).toBeInTheDocument();
  });

  it.each([
    ["owner", "Ada Lovelace made you an owner of Photosynthesis Lab"],
    ["admin", "Ada Lovelace made you an admin of Photosynthesis Lab"],
    ["member", "Ada Lovelace made you a member of Photosynthesis Lab"],
  ])("words a role change to %s in prose", async (role, message) => {
    const { container } = await renderRow(aboutOrganization("organization_role_changed", { role }));

    expect(within(container).getByText(message)).toBeInTheDocument();
  });

  it("falls back to the stored role for a token it has no copy for", async () => {
    const { container } = await renderRow(
      aboutOrganization("organization_role_changed", { role: "auditor" }),
    );

    expect(
      within(container).getByText("Ada Lovelace made you auditor in Photosynthesis Lab"),
    ).toBeInTheDocument();
  });

  it("opens the organization from a role change", async () => {
    const { container } = await renderRow(
      aboutOrganization("organization_role_changed", { role: "admin" }),
    );

    expect(within(container).getByRole("link")).toHaveAttribute(
      "href",
      expect.stringMatching(new RegExp(`/platform/organizations/${ORGANIZATION_ID}$`)),
    );
  });

  it("renders a removal with nothing to open", async () => {
    const { container } = await renderRow(aboutOrganization("organization_membership_removed", {}));

    expect(
      within(container).getByText("Ada Lovelace removed you from Photosynthesis Lab"),
    ).toBeInTheDocument();
    expect(within(container).queryByRole("link")).not.toBeInTheDocument();
    expect(within(container).getByRole("button")).toBeInTheDocument();
  });

  it("opens the members page from an accepted invitation", async () => {
    const { container } = await renderRow(
      aboutOrganization("organization_invitation_accepted", {}),
    );

    expect(
      within(container).getByText("Ada Lovelace accepted your invitation to Photosynthesis Lab"),
    ).toBeInTheDocument();
    expect(within(container).getByRole("link")).toHaveAttribute(
      "href",
      expect.stringMatching(new RegExp(`/platform/organizations/${ORGANIZATION_ID}/members$`)),
    );
  });

  it("names the table a failed upload was headed for", async () => {
    await renderRow({
      ...moved("organization"),
      type: "data_upload_failed",
      category: "data_jobs",
      actor: null,
      resource: { type: "experiment", id: "00000000-0000-4000-8000-0000000000cc" },
      params: { experimentName: "Drought trial", tableName: "leaf_traits" },
    });

    expect(
      screen.getByText("Your upload of leaf_traits to Drought trial failed"),
    ).toBeInTheDocument();
  });

  it("names the passkey that was added", async () => {
    await renderRow(passkeyAdded({ passkeyName: "Google Password Manager" }));

    expect(
      screen.getByText("A new passkey, Google Password Manager, was added to your account"),
    ).toBeInTheDocument();
  });

  it("leaves the name out for a passkey added without one", async () => {
    await renderRow(passkeyAdded({}));

    expect(screen.getByText("A new passkey was added to your account")).toBeInTheDocument();
  });
});
