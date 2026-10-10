import { render, screen } from "@/test/test-utils";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { describe, it, expect, vi } from "vitest";

import initTranslations from "@repo/i18n/server";

import Layout from "../[locale]/layout";

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
  it.each(["en-US", "de-DE"])(
    "renders %s without reading the request, so its pages can be cached",
    async (locale) => {
      const ui = await Layout({
        children: <div>Content</div>,
        params: Promise.resolve({ locale }),
      });
      render(ui);

      expect(screen.getByText("Content")).toBeInTheDocument();
      expect(headers).not.toHaveBeenCalled();
      expect(cookies).not.toHaveBeenCalled();
    },
  );

  it("inlines only the namespace every page shows", async () => {
    await Layout({
      children: <div />,
      params: Promise.resolve({ locale: "en-US" }),
    });

    expect(initTranslations).toHaveBeenCalledWith({ locale: "en-US", namespaces: ["common"] });
  });

  it("answers an unknown locale with not found", async () => {
    await Layout({
      children: <div />,
      params: Promise.resolve({ locale: "fr-FR" }),
    }).catch(() => undefined);

    expect(notFound).toHaveBeenCalled();
  });
});
