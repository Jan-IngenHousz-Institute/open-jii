import { render, screen } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getContentfulClients } from "~/lib/contentful";
import { isFeatureFlagEnabled } from "~/lib/posthog-server";

import LocaleLayout from "../../layout";
import JoinLayout from "../layout";
import { JoinLandingContent } from "./join-landing-content";
import JoinLandingPage, { generateMetadata } from "./page";

vi.mock("~/lib/posthog-server", () => ({
  isFeatureFlagEnabled: vi.fn().mockResolvedValue(true),
}));

// RTL's client renderer refuses an async component, so the layout's alerts bar is
// stubbed here and its own Contentful failure path is asserted separately below.
vi.mock("~/components/alerts-bar", () => ({ AlertsBar: () => null }));

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.openjii.app";

function renderPage(code: string) {
  return JoinLandingPage({ params: Promise.resolve({ locale: "en-US", code }) });
}

describe("JoinLandingContent", () => {
  it("renders the code, the deep link and the store link", () => {
    render(<JoinLandingContent code="KP7Q4WMX" />);

    expect(screen.getByText("KP7Q-4WMX")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "joinLanding.openApp" })).toHaveAttribute(
      "href",
      "openjii://join/KP7Q4WMX",
    );
    expect(screen.getByRole("link", { name: "joinLanding.getApp" })).toHaveAttribute(
      "href",
      PLAY_STORE_URL,
    );
    expect(screen.getByText("joinLanding.haveApp")).toBeInTheDocument();
  });
});

describe("JoinLandingPage", () => {
  beforeEach(() => {
    vi.mocked(isFeatureFlagEnabled).mockResolvedValue(true);
  });

  it("normalizes a hyphenated lowercase code before rendering", async () => {
    render(await renderPage("kp7q-4wmx"));

    expect(screen.getByText("KP7Q-4WMX")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "joinLanding.openApp" })).toHaveAttribute(
      "href",
      "openjii://join/KP7Q4WMX",
    );
  });

  it("404s on a value that is not a join code", async () => {
    const ui = await renderPage("not-a-code");

    expect(notFound).toHaveBeenCalled();
    expect(ui).toBeUndefined();
  });

  it("404s on a code carrying an excluded glyph", async () => {
    await renderPage("KP7Q-4WM0");

    expect(notFound).toHaveBeenCalled();
  });

  it("names the tab", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ locale: "en-US", code: "KP7Q4WMX" }) }),
    ).resolves.toEqual({ title: "joinLanding.title" });
  });

  it("swallows a failing CMS client in the alerts bar the layout renders", async () => {
    vi.mocked(getContentfulClients).mockRejectedValue(new Error("Contentful unavailable"));
    const { AlertsBar } =
      await vi.importActual<typeof import("~/components/alerts-bar")>("~/components/alerts-bar");

    await expect(AlertsBar({ locale: "en-US", preview: false })).resolves.toBeNull();
  });

  it("still renders the code through the real locale layout with the CMS client failing", async () => {
    // The landing page is not CMS-free: it sits under `[locale]/layout.tsx`, whose
    // alerts bar is Contentful-backed. A phone that just scanned a QR must not care.
    vi.mocked(getContentfulClients).mockRejectedValue(new Error("Contentful unavailable"));

    const page = await renderPage("kp7q-4wmx");
    const tree = await LocaleLayout({
      children: <JoinLayout>{page}</JoinLayout>,
      params: Promise.resolve({ locale: "en-US" }),
    });

    render(tree);

    expect(screen.getByText("KP7Q-4WMX")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "joinLanding.openApp" })).toBeInTheDocument();
  });
});
