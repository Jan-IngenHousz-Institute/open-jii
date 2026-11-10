import { render, screen } from "@/test/test-utils";
import { I18nextProvider, useTranslation } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as translations from "@repo/i18n";

import german from "../../../../../packages/i18n/locales/de-DE/common.json";
import english from "../../../../../packages/i18n/locales/en-US/common.json";
import { AutosaveIndicator } from "./autosave-indicator";

afterEach(() => vi.restoreAllMocks());

describe("AutosaveIndicator", () => {
  it.each([
    ["idle", "autosave.saved"],
    ["dirty", "autosave.saving"],
    ["saving", "autosave.saving"],
    ["error", "autosave.failed"],
  ] as const)("preserves the %s indication for existing callers", (status, label) => {
    render(<AutosaveIndicator status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText("autosave.invalid")).not.toBeInTheDocument();
  });

  it.each([
    ["en-US", english, "Not saved: check the chart settings"],
    ["de-DE", german, "Nicht gespeichert: Diagrammeinstellungen prüfen"],
  ] as const)(
    "explains invalid drafts in %s in full and compact toolbars",
    async (locale, copy, label) => {
      const { createInstance } = await vi.importActual<typeof translations>("@repo/i18n");
      const i18n = createInstance();
      await i18n.init({
        lng: locale,
        defaultNS: "common",
        resources: { [locale]: { common: copy } },
        interpolation: { escapeValue: false },
      });
      vi.spyOn(translations, "useTranslation").mockImplementation((ns = "common", options = {}) =>
        useTranslation(ns, options),
      );
      render(
        <I18nextProvider i18n={i18n}>
          <AutosaveIndicator status="invalid" />
          <AutosaveIndicator status="invalid" variant="compact" />
        </I18nextProvider>,
      );
      expect(screen.getByText(label)).toBeVisible();
      expect(screen.getByRole("status", { name: label })).toBeInTheDocument();
      expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
    },
  );

  it.each([
    ["saving", "Wird gespeichert…"],
    ["idle", "Alle Änderungen gespeichert"],
    ["error", "Deine Änderungen konnten nicht gespeichert werden"],
  ] as const)("translates the %s status into German", async (status, label) => {
    const { createInstance } = await vi.importActual<typeof translations>("@repo/i18n");
    const i18n = createInstance();
    await i18n.init({
      lng: "de-DE",
      defaultNS: "common",
      resources: { "de-DE": { common: german } },
      interpolation: { escapeValue: false },
    });
    vi.spyOn(translations, "useTranslation").mockImplementation((ns = "common", options = {}) =>
      useTranslation(ns, options),
    );
    render(
      <I18nextProvider i18n={i18n}>
        <AutosaveIndicator status={status} />
      </I18nextProvider>,
    );
    expect(screen.getByText(label)).toBeVisible();
  });
});
