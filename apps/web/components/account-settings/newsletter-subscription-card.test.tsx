import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { NewsletterSubscriptionCard } from "./newsletter-subscription-card";

describe("<NewsletterSubscriptionCard />", () => {
  it("renders subscribed with the toggle on", async () => {
    server.mount(contract.newsletter.getStatus, { body: { status: "subscribed" } });

    render(<NewsletterSubscriptionCard />);

    expect(await screen.findByText("settings.NewsletterSubscriptionCard.subscribed")).toBeVisible();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("renders pending as a distinct confirmation-email state", async () => {
    server.mount(contract.newsletter.getStatus, { body: { status: "pending" } });

    render(<NewsletterSubscriptionCard />);

    expect(await screen.findByText("settings.NewsletterSubscriptionCard.pending")).toBeVisible();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it.each(["unsubscribed", "none"] as const)("renders %s with the toggle off", async (status) => {
    server.mount(contract.newsletter.getStatus, { body: { status } });

    render(<NewsletterSubscriptionCard />);

    expect(
      await screen.findByText("settings.NewsletterSubscriptionCard.unsubscribed"),
    ).toBeVisible();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("renders a card-local error without a guessed toggle value", async () => {
    server.mount(contract.newsletter.getStatus, { status: 503 });

    render(<NewsletterSubscriptionCard />);

    expect(await screen.findByText("settings.NewsletterSubscriptionCard.error")).toBeVisible();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "settings.NewsletterSubscriptionCard.retry" }),
    ).toBeVisible();
  });

  it("subscribes through the direct route", async () => {
    server.mount(contract.newsletter.getStatus, { body: { status: "none" } });
    const request = server.mount(contract.newsletter.subscribeDirect, {
      body: { status: "pending" },
    });
    const user = userEvent.setup();
    render(<NewsletterSubscriptionCard />);

    await user.click(await screen.findByRole("switch"));

    await waitFor(() => expect(request.called).toBe(true));
  });

  it("shows forgotten-email guidance when the direct subscribe is rejected as forgotten", async () => {
    server.mount(contract.newsletter.getStatus, { body: { status: "none" } });
    server.mount(contract.newsletter.subscribeDirect, {
      status: 400,
      body: { code: "MAILCHIMP_FORGOTTEN_EMAIL", message: "forgotten", statusCode: 400 },
    });
    const user = userEvent.setup();
    render(<NewsletterSubscriptionCard />);

    await user.click(await screen.findByRole("switch"));

    expect(
      await screen.findByText("settings.NewsletterSubscriptionCard.forgottenEmailError"),
    ).toBeVisible();
  });

  it("keeps the generic update error for other subscribe failures", async () => {
    server.mount(contract.newsletter.getStatus, { body: { status: "none" } });
    server.mount(contract.newsletter.subscribeDirect, { status: 500 });
    const user = userEvent.setup();
    render(<NewsletterSubscriptionCard />);

    await user.click(await screen.findByRole("switch"));

    expect(
      await screen.findByText("settings.NewsletterSubscriptionCard.updateError"),
    ).toBeVisible();
  });

  it("unsubscribes through the authenticated delete route", async () => {
    server.mount(contract.newsletter.getStatus, { body: { status: "subscribed" } });
    const request = server.mount(contract.newsletter.unsubscribe, {
      body: { status: "unsubscribed" },
    });
    const user = userEvent.setup();
    render(<NewsletterSubscriptionCard />);

    await user.click(await screen.findByRole("switch"));

    await waitFor(() => expect(request.called).toBe(true));
  });
});
