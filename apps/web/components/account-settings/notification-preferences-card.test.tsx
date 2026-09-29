import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { NotificationPreferencesCard } from "./notification-preferences-card";

const preferences = [
  { category: "requests_and_invitations", channel: "email", enabled: true, locked: false },
  { category: "membership_and_access", channel: "email", enabled: true, locked: false },
  { category: "experiments_and_resources", channel: "email", enabled: true, locked: false },
  { category: "devices_and_calibration", channel: "email", enabled: true, locked: false },
  { category: "project_transfers", channel: "email", enabled: true, locked: false },
  { category: "data_jobs", channel: "email", enabled: false, locked: false },
  { category: "account_security", channel: "email", enabled: true, locked: true },
];

const DATA_JOBS = 5;
const ACCOUNT_SECURITY = 6;

describe("<NotificationPreferencesCard />", () => {
  it("shows one email switch per category with its saved state", async () => {
    server.mount(contract.notifications.getNotificationPreferences, { body: { preferences } });

    render(<NotificationPreferencesCard />);

    const switches = await screen.findAllByRole("switch");
    expect(switches).toHaveLength(7);
    expect(switches[0]).toHaveAttribute("aria-checked", "true");
    expect(switches[DATA_JOBS]).toHaveAttribute("aria-checked", "false");
  });

  it("saves a category as soon as its switch is flipped", async () => {
    server.mount(contract.notifications.getNotificationPreferences, { body: { preferences } });
    const updateRequest = server.mount(contract.notifications.updateNotificationPreference, {
      body: {
        preferences: preferences.map((preference) =>
          preference.category === "data_jobs" ? { ...preference, enabled: true } : preference,
        ),
      },
    });
    const user = userEvent.setup();
    render(<NotificationPreferencesCard />);

    const switches = await screen.findAllByRole("switch");
    await user.click(switches[DATA_JOBS]);

    await waitFor(() =>
      expect(updateRequest.body).toEqual({ category: "data_jobs", channel: "email", enabled: true }),
    );
    await waitFor(() => expect(switches[DATA_JOBS]).toHaveAttribute("aria-checked", "true"));
  });

  it("keeps account security emails on and unchangeable", async () => {
    server.mount(contract.notifications.getNotificationPreferences, { body: { preferences } });

    render(<NotificationPreferencesCard />);

    const switches = await screen.findAllByRole("switch");
    expect(switches[ACCOUNT_SECURITY]).toHaveAttribute("aria-checked", "true");
    expect(switches[ACCOUNT_SECURITY]).toBeDisabled();
    expect(screen.getByText("preferences.locked")).toBeVisible();
  });

  it("says that sign-in codes are not affected", async () => {
    server.mount(contract.notifications.getNotificationPreferences, { body: { preferences } });

    render(<NotificationPreferencesCard />);

    expect(await screen.findByText("preferences.essentialNote")).toBeVisible();
  });

  it("shows a card-local error with a retry", async () => {
    server.mount(contract.notifications.getNotificationPreferences, { status: 503 });

    render(<NotificationPreferencesCard />);

    expect(await screen.findByText("preferences.error")).toBeVisible();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "retry" })).toBeVisible();
  });

  it("keeps the switches and reports a failed save", async () => {
    server.mount(contract.notifications.getNotificationPreferences, { body: { preferences } });
    server.mount(contract.notifications.updateNotificationPreference, { status: 500 });
    const user = userEvent.setup();
    render(<NotificationPreferencesCard />);

    await user.click((await screen.findAllByRole("switch"))[0]);

    expect(await screen.findByText("preferences.updateError")).toBeVisible();
    expect(screen.getAllByRole("switch")).toHaveLength(7);
  });
});
