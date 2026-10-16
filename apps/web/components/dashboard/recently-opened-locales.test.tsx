import { createHomeExperiment, createRecentlyOpenedResource } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { I18nextProvider, useTranslation } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import * as translations from "@repo/i18n";

import german from "../../../../packages/i18n/locales/de-DE/common.json";
import english from "../../../../packages/i18n/locales/en-US/common.json";
import dutch from "../../../../packages/i18n/locales/nl-NL/common.json";
import dutchExperiments from "../../../../packages/i18n/locales/nl-NL/experiments.json";
import { RecentlyOpenedSection } from "./recently-opened-section";

describe("Recently opened translations", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => vi.restoreAllMocks());

  it("has the section's strings in each locale", () => {
    const keys: (keyof typeof english.dashboard)[] = [
      "recentlyOpened",
      "yourExperiments",
      "recentlyOpenedLoadFailed",
      "userExperimentsLoadFailed",
      "allTypes",
      "typeFilterLabel",
      "workbookVersion",
    ];
    for (const copy of [english, dutch, german]) {
      for (const key of keys) {
        expect(copy.dashboard[key]).toMatch(/\S/);
      }
      expect(Object.keys(copy.dashboard.seeAllType)).toEqual([
        "experiment",
        "protocol",
        "macro",
        "workbook",
      ]);
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
        <RecentlyOpenedSection />
      </I18nextProvider>,
    );
  }

  it("renders Dutch rows with type chips, roles and opened dates", async () => {
    server.mount(contract.experiments.listHomeExperiments, { body: { experiments: [] } });
    server.mount(contract.visits.listRecentlyOpened, {
      body: {
        items: [
          createRecentlyOpenedResource({
            type: "workbook",
            latestVersion: 2,
            callerRole: "member",
          }),
          createRecentlyOpenedResource({ type: "macro", language: "r", callerRole: null }),
        ],
        types: ["macro", "workbook"],
      },
    });

    await renderDutch();

    await screen.findByRole("heading", { name: "Recent geopend" });
    expect(screen.getByRole("radio", { name: "Alle" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Werkmappen" })).toBeInTheDocument();
    expect(screen.getByText("Versie 2")).toBeInTheDocument();
    expect(screen.getByText("Lid")).toBeInTheDocument();
    expect(screen.getAllByText(/^Geopend/)).toHaveLength(2);
  });

  it("renders the Dutch fallback with an update date rather than a visit", async () => {
    server.mount(contract.visits.listRecentlyOpened, { body: { items: [], types: [] } });
    server.mount(contract.experiments.listHomeExperiments, {
      body: { experiments: [createHomeExperiment({ name: "Dutch work", callerRole: "viewer" })] },
    });

    await renderDutch();

    await screen.findByRole("heading", { name: "Je experimenten" });
    expect(screen.getByText("Kijker")).toBeInTheDocument();
    // A date, which "Aktualisiert am" in German needs, rather than a relative time.
    expect(screen.getByText(/^Bijgewerkt/)).not.toHaveTextContent(/geleden/);
    expect(screen.queryByText(/^Geopend/)).toBeNull();
  });

  it("renders Dutch errors and retry without the raw server message", async () => {
    server.mount(contract.visits.listRecentlyOpened, {
      status: 404,
      body: { message: "private raw SQL" },
    });

    await renderDutch();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wat je onlangs hebt geopend, kon niet worden geladen.",
    );
    expect(screen.getByRole("button", { name: dutch.errors.tryAgain })).toBeInTheDocument();
    expect(screen.queryByText("private raw SQL")).toBeNull();
  });
});
