import { render, screen } from "@/test/test-utils";
import { ORPCError } from "@orpc/client";
import type { ReactElement } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import type * as translations from "@repo/i18n";
import * as clientTranslations from "@repo/i18n/client";

import english from "../../../../../../packages/i18n/locales/en-US/experimentData.json";
import { UploadHistoryError } from "./upload-history-error";

async function renderInEnglish(ui: ReactElement) {
  const { createInstance } = await vi.importActual<typeof translations>("@repo/i18n");
  const i18n = createInstance();
  await i18n.init({
    lng: "en-US",
    defaultNS: "experimentData",
    resources: { "en-US": { experimentData: english } },
    interpolation: { escapeValue: false },
  });
  vi.spyOn(clientTranslations, "useTranslation").mockImplementation(
    (ns = "experimentData", options = {}) => useTranslation(ns, options),
  );
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("UploadHistoryError", () => {
  afterEach(() => vi.restoreAllMocks());

  it("passes on the message the API gave", async () => {
    await renderInEnglish(
      <UploadHistoryError
        error={new ORPCError("NOT_FOUND", { message: "Experiment not found" })}
      />,
    );

    expect(
      screen.getByText("Uploads could not be loaded: Experiment not found"),
    ).toBeInTheDocument();
  });

  it("falls back to an unknown error when the API gave no message", async () => {
    await renderInEnglish(<UploadHistoryError error={new Error("network down")} />);

    expect(
      screen.getByText("Uploads could not be loaded: An unknown error occurred"),
    ).toBeInTheDocument();
  });
});
