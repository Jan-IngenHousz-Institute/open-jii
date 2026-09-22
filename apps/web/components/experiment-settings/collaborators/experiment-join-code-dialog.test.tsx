import { server } from "@/test/msw/server";
import { act, fireEvent, render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { focusManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { QrCode } from "@repo/ui/components/qr-code";

import { ExperimentJoinCodeButton } from "./experiment-join-code-dialog";

const EXPERIMENT_ID = "22222222-2222-2222-2222-222222222222";

// The site language the organizer is browsing in. The landing URL must ignore it.
const { localeRef } = vi.hoisted(() => ({ localeRef: { current: "en-US" } }));
vi.mock("@/hooks/useLocale", () => ({ useLocale: () => localeRef.current }));

const ACTIVE_CODE = {
  id: "11111111-1111-1111-1111-111111111111",
  experimentId: EXPERIMENT_ID,
  code: "KP7Q4WMX",
  expiresAt: "2026-09-25T00:00:00.000Z",
  redemptionCount: 0,
  createdAt: "2026-09-18T00:00:00.000Z",
  createdBy: null,
};

/**
 * Mounts the button and opens the dialog, which is the only way its states render.
 * `userEvent` is not used for the open click: several cases run on fake timers,
 * where its internal delays never resolve.
 */
function renderCard() {
  const result = render(<ExperimentJoinCodeButton experimentId={EXPERIMENT_ID} />);
  fireEvent.click(screen.getByRole("button", { name: /joinCode\.title/ }));
  return result;
}

/** Mounts the button alone, for the cases that are about the trigger itself. */
function renderButton() {
  return render(<ExperimentJoinCodeButton experimentId={EXPERIMENT_ID} />);
}

/**
 * The module path, not the background tile `qrcode.react` draws first. The
 * colour contract itself is guarded in `packages/ui`; here only the encoded
 * value matters, so the path is picked positionally rather than by fill.
 */
function modulesOf(root: Element | null): string | null {
  const paths = Array.from(root?.querySelectorAll("svg path") ?? []);
  return paths[1]?.getAttribute("d") ?? null;
}

describe("ExperimentJoinCodeDialog", () => {
  beforeEach(() => {
    localeRef.current = "en-US";
  });

  afterEach(() => {
    vi.useRealTimers();
    focusManager.setFocused(undefined);
  });

  it("shows a loading line while the read is in flight", () => {
    server.mount(contract.experiments.getJoinCode, {
      body: { joinCode: null },
      delay: "infinite",
    });

    renderCard();

    expect(screen.getByText("joinCode.loading")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "joinCode.create" })).not.toBeInTheDocument();
  });

  it("shows the error state with Retry and never the create form when the read fails", async () => {
    server.mount(contract.experiments.getJoinCode, { status: 500 });

    renderCard();

    expect(await screen.findByText("joinCode.loadFailed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "joinCode.retry" })).toBeInTheDocument();
    // The bug this guards: a failed read rendered as "no code yet" invites the
    // organizer to mint a second code over one that already exists.
    expect(screen.queryByRole("button", { name: "joinCode.create" })).not.toBeInTheDocument();
    expect(screen.queryByText("joinCode.introEmpty joinCode.workbookHint")).not.toBeInTheDocument();
  });

  it("recovers to the create form when Retry succeeds", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.getJoinCode, { status: 500 });

    renderCard();
    await screen.findByText("joinCode.loadFailed");

    server.mount(contract.experiments.getJoinCode, { body: { joinCode: null } });
    await user.click(screen.getByRole("button", { name: "joinCode.retry" }));

    expect(await screen.findByRole("button", { name: "joinCode.create" })).toBeInTheDocument();
  });

  it("offers the expiry select and Create for a 200 with no code, including the workbook sentence", async () => {
    server.mount(contract.experiments.getJoinCode, { body: { joinCode: null } });

    renderCard();

    expect(await screen.findByRole("button", { name: "joinCode.create" })).toBeInTheDocument();
    expect(screen.getByText("joinCode.introEmpty joinCode.workbookHint")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "joinCode.expiresIn" })).toHaveTextContent(
      "joinCode.expiry.7d",
    );
  });

  it("sends the selected expiry when the code is created", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.getJoinCode, { body: { joinCode: null } });
    const create = server.mount(contract.experiments.createJoinCode, { body: ACTIVE_CODE });

    renderCard();

    await user.click(await screen.findByRole("combobox", { name: "joinCode.expiresIn" }));
    await user.click(await screen.findByRole("option", { name: "joinCode.expiry.30d" }));
    await user.click(screen.getByRole("button", { name: "joinCode.create" }));

    await waitFor(() => expect(create.body).toMatchObject({ expiresIn: "30d" }));
  });

  it("renders the code, QR, expiry, counter and actions for an active code", async () => {
    server.mount(contract.experiments.getJoinCode, { body: { joinCode: ACTIVE_CODE } });

    renderCard();

    expect(await screen.findByText("KP7Q-4WMX")).toBeInTheDocument();
    expect(screen.getByText("joinCode.introActive joinCode.workbookHint")).toBeInTheDocument();
    expect(screen.getByText(/joinCode\.expiresOn/)).toBeInTheDocument();
    expect(screen.getByText(/joinCode\.redeemed:0/)).toBeInTheDocument();
    expect(
      screen.getByRole("dialog").querySelector('[aria-label="joinCode.qrLabel"] svg'),
    ).not.toBeNull();
    for (const name of ["joinCode.copyCode", "joinCode.copyLink", "joinCode.regenerate"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "joinCode.revoke" })).toBeInTheDocument();
  });

  it("says the code never expires when there is no expiry", async () => {
    server.mount(contract.experiments.getJoinCode, {
      body: { joinCode: { ...ACTIVE_CODE, expiresAt: null } },
    });

    renderCard();

    expect(await screen.findByText(/joinCode\.neverExpires/)).toBeInTheDocument();
  });

  it("copies the formatted code and the en-US landing URL whatever the site language is", async () => {
    const user = userEvent.setup();
    // `userEvent.setup()` installs its own clipboard stub, so this has to land after it.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    localeRef.current = "nl-NL";
    server.mount(contract.experiments.getJoinCode, { body: { joinCode: ACTIVE_CODE } });

    renderCard();

    await user.click(await screen.findByRole("button", { name: "joinCode.copyCode" }));
    expect(writeText).toHaveBeenCalledWith("KP7Q-4WMX");

    await user.click(screen.getByRole("button", { name: "joinCode.copyLink" }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/en-US/join/KP7Q-4WMX`);
  });

  it("encodes that same URL in the QR", async () => {
    localeRef.current = "nl-NL";
    server.mount(contract.experiments.getJoinCode, { body: { joinCode: ACTIVE_CODE } });

    renderCard();
    await screen.findByText("KP7Q-4WMX");

    const rendered = modulesOf(
      screen.getByRole("dialog").querySelector('[aria-label="joinCode.qrLabel"]'),
    );
    const expected = modulesOf(
      render(<QrCode value={`${window.location.origin}/en-US/join/KP7Q-4WMX`} />).container,
    );

    expect(rendered).toBeTruthy();
    expect(rendered).toBe(expected);
  });

  it("confirms before regenerating and keeps the selected expiry", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.getJoinCode, { body: { joinCode: ACTIVE_CODE } });
    const create = server.mount(contract.experiments.createJoinCode, { body: ACTIVE_CODE });

    renderCard();

    await user.click(await screen.findByRole("button", { name: "joinCode.regenerate" }));
    expect(await screen.findByText("joinCode.confirmBody")).toBeInTheDocument();
    expect(create.called).toBe(false);

    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "joinCode.regenerate" }));

    await waitFor(() => expect(create.body).toMatchObject({ expiresIn: "7d" }));
  });

  it("confirms before revoking", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.getJoinCode, { body: { joinCode: ACTIVE_CODE } });
    const revoke = server.mount(contract.experiments.revokeJoinCode);

    renderCard();

    await user.click(await screen.findByRole("button", { name: "joinCode.revoke" }));
    expect(await screen.findByText("joinCode.confirmBody")).toBeInTheDocument();
    expect(revoke.called).toBe(false);

    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "joinCode.revoke" }));

    await waitFor(() => expect(revoke.called).toBe(true));
  });

  it("shows the expired banner and Create a new code for a past expiry", async () => {
    server.mount(contract.experiments.getJoinCode, {
      body: { joinCode: { ...ACTIVE_CODE, expiresAt: "2020-01-01T00:00:00.000Z" } },
    });

    renderCard();

    expect(await screen.findByText("joinCode.expiredBanner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "joinCode.createAgain" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "joinCode.copyCode" })).not.toBeInTheDocument();
  });

  it("flips to the expired state when the clock passes expiresAt, with no reload", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-18T00:00:00.000Z"));
    server.mount(contract.experiments.getJoinCode, {
      body: { joinCode: { ...ACTIVE_CODE, expiresAt: "2026-09-18T00:00:30.000Z" } },
    });

    renderCard();

    expect(await screen.findByText("KP7Q-4WMX")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    expect(screen.getByText("joinCode.expiredBanner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "joinCode.createAgain" })).toBeInTheDocument();
  });

  it("flips a 30-day code, whose delay overflows a 32-bit timer, on its own timer", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-18T00:00:00.000Z"));
    // 30 days is ~2.59e9 ms, past setTimeout's signed 32-bit ceiling of ~24.8 days,
    // so no single timer spans it and the card has to re-arm to reach the deadline.
    server.mount(contract.experiments.getJoinCode, {
      body: { joinCode: { ...ACTIVE_CODE, expiresAt: "2026-10-18T00:00:00.000Z" } },
    });

    renderCard();
    expect(await screen.findByText("KP7Q-4WMX")).toBeInTheDocument();

    // Background the tab so the 10 s poll stops issuing requests: 30 days of them
    // is ~268k round trips, and this case is about the timer, not the poll.
    focusManager.setFocused(false);
    // Advanced synchronously: the async variant flushes microtasks per timer, and
    // 30 days of the 10 s poll is ~268k of them, which is slow enough to time out
    // under a loaded full-suite run.
    act(() => {
      vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);
    });

    expect(screen.getByText("joinCode.expiredBanner")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "joinCode.copyCode" })).not.toBeInTheDocument();
  });

  it("flips a long-lived code from the poll clock even if its timer never fires", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-18T00:00:00.000Z"));
    server.mount(contract.experiments.getJoinCode, {
      body: { joinCode: { ...ACTIVE_CODE, expiresAt: "2026-10-18T00:00:00.000Z" } },
    });

    renderCard();
    expect(await screen.findByText("KP7Q-4WMX")).toBeInTheDocument();

    // Jump the wall clock past the deadline without running the 30 days of timers
    // in between, which is what a throttled or suspended tab does to a pending one.
    vi.setSystemTime(new Date("2026-10-18T00:00:01.000Z"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_500);
    });

    expect(screen.getByText("joinCode.expiredBanner")).toBeInTheDocument();
  });

  it("renders expired immediately when the response arrives after the deadline", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-18T00:00:00.000Z"));
    // Mounted before expiry, answered after it: there is no future deadline left
    // to schedule, so the clock the card renders against has to be the current one.
    server.mount(contract.experiments.getJoinCode, {
      body: { joinCode: { ...ACTIVE_CODE, expiresAt: "2026-09-18T00:00:10.000Z" } },
      delay: 20_000,
    });

    renderCard();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(21_000);
    });

    expect(await screen.findByText("joinCode.expiredBanner")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "joinCode.copyCode" })).not.toBeInTheDocument();
  });

  it("updates the joined count from a poll, with no mutation in between", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let redemptionCount = 0;
    const get = server.mount(contract.experiments.getJoinCode, {
      body: () => ({ joinCode: { ...ACTIVE_CODE, redemptionCount } }),
    });
    const create = server.mount(contract.experiments.createJoinCode, { body: ACTIVE_CODE });

    renderCard();

    expect(await screen.findByText(/joinCode\.redeemed:0/)).toBeInTheDocument();

    redemptionCount = 3;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_500);
    });

    await waitFor(() => expect(screen.getByText(/joinCode\.redeemed:3/)).toBeInTheDocument());
    expect(get.callCount).toBeGreaterThan(1);
    expect(create.called).toBe(false);
  });

  it("does not poll while the tab is in the background", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const get = server.mount(contract.experiments.getJoinCode, {
      body: { joinCode: ACTIVE_CODE },
    });

    renderCard();
    expect(await screen.findByText("KP7Q-4WMX")).toBeInTheDocument();
    expect(get.callCount).toBe(1);

    focusManager.setFocused(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(35_000);
    });

    expect(get.callCount).toBe(1);
  });
});

describe("QrCode", () => {
  it("encodes different values into different modules", () => {
    const first = render(<QrCode value="https://openjii.org/en-US/join/KP7Q-4WMX" />);
    const second = render(<QrCode value="https://openjii.org/en-US/join/ABCD-EFGH" />);

    const firstPath = modulesOf(first.container);
    const secondPath = modulesOf(second.container);

    expect(firstPath).toBeTruthy();
    expect(secondPath).toBeTruthy();
    expect(firstPath).not.toBe(secondPath);
  });
});

describe("ExperimentJoinCodeButton", () => {
  afterEach(() => {
    vi.useRealTimers();
    focusManager.setFocused(undefined);
  });

  it("carries the redemption count while a code is live", async () => {
    server.mount(contract.experiments.getJoinCode, {
      body: { joinCode: { ...ACTIVE_CODE, redemptionCount: 27 } },
    });

    renderButton();

    const button = await screen.findByRole("button", { name: /joinCode\.title/ });
    await waitFor(() => expect(within(button).getByText("27")).toBeInTheDocument());
    // Labelled rather than a bare number, so the trigger still announces what it counts.
    expect(within(button).getByLabelText("joinCode.redeemed:27")).toBeInTheDocument();
  });

  it("shows no count when there is no code", async () => {
    server.mount(contract.experiments.getJoinCode, { body: { joinCode: null } });

    renderButton();

    const button = await screen.findByRole("button", { name: /joinCode\.title/ });
    await waitFor(() => expect(button).toHaveAccessibleName("joinCode.title"));
    expect(within(button).queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("shows no count for an expired code", async () => {
    server.mount(contract.experiments.getJoinCode, {
      body: {
        joinCode: { ...ACTIVE_CODE, redemptionCount: 27, expiresAt: "2020-01-01T00:00:00.000Z" },
      },
    });

    renderButton();

    const button = await screen.findByRole("button", { name: /joinCode\.title/ });
    await waitFor(() => expect(button).toHaveAccessibleName("joinCode.title"));
    expect(within(button).queryByText("27")).not.toBeInTheDocument();
  });

  it("drops the count on the fetch that reports the code revoked", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let revoked = false;
    server.mount(contract.experiments.getJoinCode, {
      body: () => ({ joinCode: revoked ? null : { ...ACTIVE_CODE, redemptionCount: 27 } }),
    });

    renderButton();
    const button = await screen.findByRole("button", { name: /joinCode\.title/ });
    await waitFor(() => expect(within(button).getByText("27")).toBeInTheDocument());

    // Opened so the poll is running, which is the only thing that re-reads here.
    fireEvent.click(button);
    revoked = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_500);
    });

    await waitFor(() => expect(within(button).queryByText("27")).not.toBeInTheDocument());
  });

  it("does not poll while the dialog is closed, and does while it is open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const get = server.mount(contract.experiments.getJoinCode, {
      body: { joinCode: ACTIVE_CODE },
    });

    renderButton();
    await screen.findByRole("button", { name: /joinCode\.title/ });
    await waitFor(() => expect(get.callCount).toBe(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(35_000);
    });
    expect(get.callCount).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: /joinCode\.title/ }));
    await screen.findByRole("dialog");
    const afterOpen = get.callCount;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(35_000);
    });
    expect(get.callCount).toBeGreaterThan(afterOpen);
  });
});
