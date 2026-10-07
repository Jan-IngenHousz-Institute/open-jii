import { API_URL } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { NotificationPreferencesCard } from "./notification-preferences-card";

/** The two categories whose emails exist today are the only toggleable ones. */
const preferences = [
  {
    category: "requests_and_invitations",
    channel: "email",
    enabled: true,
    locked: false,
    available: true,
  },
  {
    category: "membership_and_access",
    channel: "email",
    enabled: true,
    locked: false,
    available: true,
  },
  {
    category: "experiments_and_resources",
    channel: "email",
    enabled: true,
    locked: false,
    available: false,
  },
  {
    category: "devices_and_calibration",
    channel: "email",
    enabled: true,
    locked: false,
    available: false,
  },
  {
    category: "project_transfers",
    channel: "email",
    enabled: true,
    locked: false,
    available: false,
  },
  { category: "data_jobs", channel: "email", enabled: false, locked: false, available: false },
  { category: "account_security", channel: "email", enabled: true, locked: true, available: false },
];

const REQUESTS = 0;
const MEMBERSHIP = 1;
const EXPERIMENTS = 2;
const ACCOUNT_SECURITY = 6;

/** The response for a flip: the whole resolved set with one row changed. */
function withCategory(category: string, enabled: boolean) {
  return {
    preferences: preferences.map((preference) =>
      preference.category === category ? { ...preference, enabled } : preference,
    ),
  };
}

describe("<NotificationPreferencesCard />", () => {
  it("shows one email switch per category with its saved state", async () => {
    server.mount(contract.notifications.getNotificationPreferences, { body: { preferences } });

    render(<NotificationPreferencesCard />);

    const switches = await screen.findAllByRole("switch");
    expect(switches).toHaveLength(7);
    expect(switches[REQUESTS]).toHaveAttribute("aria-checked", "true");
    expect(switches[MEMBERSHIP]).toHaveAttribute("aria-checked", "true");
  });

  it("saves a category as soon as its switch is flipped", async () => {
    server.mount(contract.notifications.getNotificationPreferences, { body: { preferences } });
    const updateRequest = server.mount(contract.notifications.updateNotificationPreference, {
      body: withCategory("membership_and_access", false),
    });
    const user = userEvent.setup();
    render(<NotificationPreferencesCard />);

    const switches = await screen.findAllByRole("switch");
    await user.click(switches[MEMBERSHIP]);

    await waitFor(() =>
      expect(updateRequest.body).toEqual({
        category: "membership_and_access",
        channel: "email",
        enabled: false,
      }),
    );
    await waitFor(() => expect(switches[MEMBERSHIP]).toHaveAttribute("aria-checked", "false"));
  });

  /**
   * A category with no email behind it yet is shown so the tab is a complete list,
   * but offering a switch that changes nothing is a fake feel of control.
   */
  it("shows a category with no email yet as off, disabled and labelled", async () => {
    server.mount(contract.notifications.getNotificationPreferences, { body: { preferences } });
    const updateRequest = server.mount(contract.notifications.updateNotificationPreference, {
      body: { preferences },
    });
    const user = userEvent.setup();
    render(<NotificationPreferencesCard />);

    const switches = await screen.findAllByRole("switch");
    // Seeded `enabled: true`, and still rendered off: the stored value would promise
    // an effect the category has not got.
    expect(switches[EXPERIMENTS]).toHaveAttribute("aria-checked", "false");
    expect(switches[EXPERIMENTS]).toBeDisabled();
    expect(screen.getAllByText("preferences.unavailable")).toHaveLength(4);

    await user.click(switches[EXPERIMENTS]);
    expect(updateRequest.called).toBe(false);
  });

  /**
   * A save holds its own switch only. The scaffold disabled all seven, which made
   * the second of two quick flips a dead click.
   */
  it("keeps the other categories usable while one of them saves", async () => {
    server.mount(contract.notifications.getNotificationPreferences, { body: { preferences } });
    let land!: () => void;
    const landed = new Promise<void>((resolve) => {
      land = resolve;
    });
    server.mount(contract.notifications.updateNotificationPreference, {
      body: withCategory("membership_and_access", false),
      unblock: landed,
    });
    const user = userEvent.setup();
    render(<NotificationPreferencesCard />);

    const switches = await screen.findAllByRole("switch");
    await user.click(switches[MEMBERSHIP]);

    await waitFor(() => expect(switches[MEMBERSHIP]).toBeDisabled());
    // Only the other *live* switch can be enabled: the four unavailable ones and the
    // locked one are disabled for their own reasons, not because a save is running.
    expect(switches[REQUESTS]).toBeEnabled();

    land();
    await waitFor(() => expect(switches[MEMBERSHIP]).toBeEnabled());
  });

  /**
   * Two saves in flight at once, answered out of order.
   *
   * Each response carries the whole resolved set as it looked before the other save
   * was written, so replacing the cache with the late-landing first response would
   * put the second category back. Each switch also has to wait for its own request:
   * a `useMutation` result tracks only its latest call, which would re-enable the
   * first switch the moment the second was flipped.
   */
  it("settles both switches at the server's state when two saves overlap", async () => {
    server.mount(contract.notifications.getNotificationPreferences, { body: { preferences } });

    // `server.mount`'s `unblock` is one promise for every call, which can only release
    // both saves together. Releasing them individually — the whole point here — needs a
    // gate per category, so this one endpoint is handled directly.
    const gates = new Map<string, () => void>();
    const held = (category: string) => new Promise<void>((resolve) => gates.set(category, resolve));
    const requestsLanded = held("requests_and_invitations");
    const membershipLanded = held("membership_and_access");
    const waiting: Record<string, Promise<void>> = {
      requests_and_invitations: requestsLanded,
      membership_and_access: membershipLanded,
    };

    server.use(
      http.put(`${API_URL}/api/v1/notifications/preferences`, async ({ request }) => {
        const body = (await request.json()) as { category: string; enabled: boolean };
        // Each response carries the set as it looked when this save was made, with
        // no knowledge of the other one in flight.
        const snapshot = withCategory(body.category, body.enabled);
        await waiting[body.category];
        return HttpResponse.json(snapshot, { status: 200 });
      }),
    );

    const user = userEvent.setup();
    render(<NotificationPreferencesCard />);

    const switches = await screen.findAllByRole("switch");
    await user.click(switches[REQUESTS]);
    await waitFor(() => expect(switches[REQUESTS]).toBeDisabled());

    await user.click(switches[MEMBERSHIP]);
    // The first save is still out, so its switch must still be held.
    expect(switches[REQUESTS]).toBeDisabled();

    // Second in, first out: the stale full-set snapshot arrives last.
    gates.get("membership_and_access")?.();
    await waitFor(() => expect(switches[MEMBERSHIP]).toBeEnabled());
    gates.get("requests_and_invitations")?.();

    await waitFor(() => expect(switches[REQUESTS]).toBeEnabled());
    await waitFor(() => expect(switches[MEMBERSHIP]).toBeEnabled());
    expect(switches[REQUESTS]).toHaveAttribute("aria-checked", "false");
    expect(switches[MEMBERSHIP]).toHaveAttribute("aria-checked", "false");
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

    await user.click((await screen.findAllByRole("switch"))[REQUESTS]);

    expect(await screen.findByText("preferences.updateError")).toBeVisible();
    expect(screen.getAllByRole("switch")).toHaveLength(7);
  });
});
