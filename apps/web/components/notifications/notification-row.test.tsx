import { render, screen } from "@/test/test-utils";
import { I18nextProvider, useTranslation } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Notification } from "@repo/api/domains/notification/notification.schema";
import * as translations from "@repo/i18n";

import english from "../../../../packages/i18n/locales/en-US/notifications.json";
import { NotificationRow } from "./notification-row";

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
});
