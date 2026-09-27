import { render, screen } from "@/test/test-utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { afterEach, describe, it, expect, vi } from "vitest";
import * as posthogServer from "~/lib/posthog-server";

import Layout from "../[locale]/layout";

vi.mock("~/lib/posthog-server", () => ({
  isFeatureFlagEnabledForViewer: vi.fn().mockResolvedValue(true),
}));

vi.mock("@repo/cms/contentful", () => ({
  ContentfulPreviewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/translations-provider", () => ({
  TranslationsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../hooks/usePostHogAuth", () => ({
  PostHogIdentifier: () => null,
}));

vi.mock("../../providers/QueryProvider", () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../components/alerts-bar", () => ({
  AlertsBar: () => null,
}));

describe("LocaleLayout", () => {
  afterEach(() => {
    vi.mocked(posthogServer.isFeatureFlagEnabledForViewer).mockResolvedValue(true);
  });

  it("renders the default locale without checking the multi-language flag", async () => {
    const ui = await Layout({
      children: <div>Content</div>,
      params: Promise.resolve({ locale: "en-US" }),
    });
    render(ui);
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(posthogServer.isFeatureFlagEnabledForViewer).not.toHaveBeenCalled();
  });

  it("renders another locale when multi-language is enabled for the viewer", async () => {
    const ui = await Layout({
      children: <div>Content</div>,
      params: Promise.resolve({ locale: "de-DE" }),
    });
    render(ui);
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(posthogServer.isFeatureFlagEnabledForViewer).toHaveBeenCalledWith("multi-language");
  });

  it("sends the viewer to the same page in the default locale when multi-language is off", async () => {
    vi.mocked(posthogServer.isFeatureFlagEnabledForViewer).mockResolvedValue(false);
    vi.mocked(headers).mockResolvedValueOnce(
      new Headers({
        "x-current-path": "/de-DE/login",
        "x-current-search": "?callbackUrl=%2Fde-DE%2Fplatform",
      }),
    );

    await Layout({
      children: <div />,
      params: Promise.resolve({ locale: "de-DE" }),
    }).catch(() => undefined);

    expect(redirect).toHaveBeenCalledWith("/en-US/login?callbackUrl=%2Fde-DE%2Fplatform");
  });
});
