import { screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TranslationsProvider } from "~/components/translations-provider";
import { renderWithTranslations, stubStatusFetch } from "~/test/render-status";

import { defaultLocale } from "@repo/i18n/config";
import { loadNamespaceBundles } from "@repo/i18n/server";

import Page from "../page";

const NOSCRIPT_TEXT = "This page needs JavaScript to show the current status.";

async function prerender() {
  const resources = await loadNamespaceBundles(defaultLocale, ["status"]);

  return renderToStaticMarkup(
    <TranslationsProvider locale={defaultLocale} namespaces={["status"]} resources={resources}>
      <Page />
    </TranslationsProvider>,
  );
}

describe("the page without scripts", () => {
  it("prerenders a line saying the status needs JavaScript", async () => {
    const html = await prerender();

    expect(html).toContain("<noscript>");
    expect(html).toContain(NOSCRIPT_TEXT);
  });

  it("prerenders the slow-network note beside the loading skeleton", async () => {
    const html = await prerender();

    expect(html).toContain(
      "This is taking longer than usual, which often means a slow or dropped connection.",
    );
  });

  it("does not show the line once scripts run", () => {
    stubStatusFetch("pending");
    renderWithTranslations(<Page />);

    expect(screen.queryByText(NOSCRIPT_TEXT)).not.toBeInTheDocument();
  });
});
