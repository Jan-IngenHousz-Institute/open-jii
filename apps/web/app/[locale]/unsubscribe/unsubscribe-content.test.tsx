import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import UnsubscribePage, { generateMetadata } from "./page";
import { UnsubscribeContent } from "./unsubscribe-content";

const TOKEN = "eyJ2IjoxfQ.c2lnbmF0dXJl";
const UNSUBSCRIBE_PATH = `/api/v1/notifications/email/unsubscribe/${TOKEN}`;
const RESUBSCRIBE_PATH = `/api/v1/notifications/email/resubscribe/${TOKEN}`;
const SETTINGS_PATH = "/en-US/platform/account/notifications";

const pathOf = (url: string) => new URL(url).pathname;

function renderContent() {
  return render(<UnsubscribeContent token={TOKEN} locale="en-US" />);
}

describe("UnsubscribeContent", () => {
  it("unsubscribes on mount and names the category", async () => {
    const unsubscribe = server.mount(contract.notifications.unsubscribeEmailByToken, {
      body: { category: "requests_and_invitations" },
    });

    renderContent();

    expect(screen.getByRole("status")).toHaveTextContent("unsubscribe.working");
    expect(
      await screen.findByRole("heading", { name: "unsubscribe.done.heading" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("unsubscribe.done.body:categories.requests_and_invitations.label"),
    ).toBeInTheDocument();
    expect(unsubscribe.callCount).toBe(1);
    expect(pathOf(unsubscribe.url)).toBe(UNSUBSCRIBE_PATH);
    expect(unsubscribe.params.token).toBe(TOKEN);
    expect(unsubscribe.body).toBeNull();
  });

  it("turns the category back on with Undo, using the same token", async () => {
    const unsubscribe = server.mount(contract.notifications.unsubscribeEmailByToken, {
      body: { category: "requests_and_invitations" },
    });
    const resubscribe = server.mount(contract.notifications.resubscribeEmailByToken, {
      body: { category: "requests_and_invitations" },
    });
    const user = userEvent.setup();

    renderContent();
    await user.click(await screen.findByRole("button", { name: "unsubscribe.undo" }));

    expect(
      await screen.findByRole("heading", { name: "unsubscribe.undone.heading" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("unsubscribe.undone.body:categories.requests_and_invitations.label"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "unsubscribe.undo" })).not.toBeInTheDocument();
    expect(resubscribe.callCount).toBe(1);
    expect(pathOf(resubscribe.url)).toBe(RESUBSCRIBE_PATH);
    expect(resubscribe.body).toBeNull();
    expect(unsubscribe.callCount).toBe(1);
  });

  it("links every settled card to the notification settings tab", async () => {
    server.mount(contract.notifications.unsubscribeEmailByToken, {
      body: { category: "membership_and_access" },
    });

    renderContent();

    expect(await screen.findByRole("link", { name: "unsubscribe.settings" })).toHaveAttribute(
      "href",
      SETTINGS_PATH,
    );
  });

  it("says the link no longer works when the token is refused, and offers sign-in back to the tab", async () => {
    const unsubscribe = server.mount(contract.notifications.unsubscribeEmailByToken, {
      status: 400,
      body: { code: "BAD_REQUEST", status: 400, message: "Unsubscribe link is invalid or expired" },
    });

    renderContent();

    expect(
      await screen.findByRole("heading", { name: "unsubscribe.invalid.heading" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "unsubscribe.signIn" })).toHaveAttribute(
      "href",
      `/en-US/login?callbackUrl=${encodeURIComponent(SETTINGS_PATH)}`,
    );
    expect(screen.queryByRole("button", { name: "unsubscribe.retry" })).not.toBeInTheDocument();
    expect(unsubscribe.callCount).toBe(1);
  });

  it("offers a retry when the update fails for another reason, and posts again", async () => {
    const unsubscribe = server.mount(contract.notifications.unsubscribeEmailByToken, {
      status: 500,
    });
    const user = userEvent.setup();

    renderContent();
    await user.click(await screen.findByRole("button", { name: "unsubscribe.retry" }));

    await waitFor(() => expect(unsubscribe.callCount).toBe(2));
    expect(unsubscribe.calls.map((call) => pathOf(call.url))).toEqual([
      UNSUBSCRIBE_PATH,
      UNSUBSCRIBE_PATH,
    ]);
    expect(screen.getByText("unsubscribe.error.body")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "unsubscribe.invalid.heading" })).toBeNull();
  });
});

describe("UnsubscribePage", () => {
  const renderPage = (token?: string | string[]) =>
    UnsubscribePage({
      params: Promise.resolve({ locale: "en-US" }),
      searchParams: Promise.resolve(token === undefined ? {} : { token }),
    });

  it.each([
    ["no token", undefined],
    ["an empty token", ""],
    ["a repeated token", ["a", "b"]],
  ])("is a 404 with %s", async (_, token) => {
    await renderPage(token);

    expect(notFound).toHaveBeenCalled();
  });

  it("hands the token and locale to the content", async () => {
    server.mount(contract.notifications.unsubscribeEmailByToken, {
      body: { category: "requests_and_invitations" },
    });

    render(await renderPage(TOKEN));

    expect(
      await screen.findByRole("heading", { name: "unsubscribe.done.heading" }),
    ).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("titles the page from the unsubscribe copy", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ locale: "en-US" }) }),
    ).resolves.toEqual({ title: "unsubscribe.title" });
  });
});
