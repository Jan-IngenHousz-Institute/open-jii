import { createHomeExperiment, createRecentlyOpenedExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { I18nextProvider, useTranslation } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import * as translations from "@repo/i18n";

import german from "../../../../packages/i18n/locales/de-DE/common.json";
import english from "../../../../packages/i18n/locales/en-US/common.json";
import dutch from "../../../../packages/i18n/locales/nl-NL/common.json";
import dutchExperiments from "../../../../packages/i18n/locales/nl-NL/experiments.json";
import { UserExperimentsSection } from "./user-experiments-section";

describe("Home experiment translations", () => {
  afterEach(() => vi.restoreAllMocks());

  it("has all four home strings in each locale", () => {
    for (const copy of [english, dutch, german]) {
      for (const key of [
        "yourExperiments",
        "recentlyOpenedExperiments",
        "userExperimentsLoadFailed",
        "userExperimentsRetry",
      ] as const) {
        expect(copy.dashboard[key]).toEqual(expect.any(String));
        expect(copy.dashboard[key].length).toBeGreaterThan(0);
      }
    }
  });

  async function renderDutch() {
    const { createInstance } = await vi.importActual<typeof translations>("@repo/i18n");
    const i18n = createInstance();
    await i18n.init({
      lng: "nl-NL",
      defaultNS: "common",
      resources: { "nl-NL": { common: dutch, experiments: dutchExperiments } },
      interpolation: { escapeValue: false },
    });
    vi.spyOn(translations, "useTranslation").mockImplementation((ns = "common", options = {}) =>
      useTranslation(ns, options),
    );
    return render(
      <I18nextProvider i18n={i18n}>
        <UserExperimentsSection />
      </I18nextProvider>,
    );
  }

  it("renders Dutch fallback with the current role and an update date", async () => {
    server.mount(contract.experiments.listHomeExperiments, {
      body: {
        source: "related",
        experiments: [createHomeExperiment({ name: "Dutch work", callerRole: "viewer" })],
      },
    });
    await renderDutch();
    await screen.findByRole("heading", { name: "Je experimenten" });
    expect(screen.getByText("Kijker")).toBeInTheDocument();
    expect(screen.getByText(/^Bijgewerkt/)).toBeInTheDocument();
    expect(screen.queryByText(/^Geopend/)).toBeNull();
  });

  it("renders Dutch visited work with its actual opened date", async () => {
    server.mount(contract.experiments.listHomeExperiments, {
      body: {
        source: "recently-opened",
        experiments: [createRecentlyOpenedExperiment({ callerRole: "member" })],
      },
    });
    await renderDutch();
    await screen.findByRole("heading", { name: "Recent geopend" });
    expect(screen.getByText("Lid")).toBeInTheDocument();
    expect(screen.getByText(/^Geopend/)).toBeInTheDocument();
  });

  it("renders Dutch errors and retry without the raw server message", async () => {
    server.mount(contract.experiments.listHomeExperiments, {
      status: 404,
      body: { message: "private raw SQL" },
    });
    await renderDutch();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Je experimenten konden niet worden geladen.",
    );
    expect(screen.getByRole("button", { name: "Opnieuw proberen" })).toBeInTheDocument();
    expect(screen.queryByText("private raw SQL")).toBeNull();
  });
});
