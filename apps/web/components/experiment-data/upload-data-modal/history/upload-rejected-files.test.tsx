import { render, screen } from "@/test/test-utils";
import type { ReactElement } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import type * as translations from "@repo/i18n";
import * as clientTranslations from "@repo/i18n/client";

import english from "../../../../../../packages/i18n/locales/en-US/experimentData.json";
import { UploadRejectedFiles } from "./upload-rejected-files";

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

describe("UploadRejectedFiles", () => {
  afterEach(() => vi.restoreAllMocks());

  it("counts the rejected files against every file in the upload", async () => {
    await renderInEnglish(
      <UploadRejectedFiles
        sourceKind="csv"
        rejectedFiles={[
          { name: "broken.csv", reason: "unparseable" },
          { name: "empty.csv", reason: "no_rows" },
        ]}
        fileCount={5}
      />,
    );

    expect(screen.getByText("2 of 5 files rejected")).toBeInTheDocument();
  });

  it("names each rejected file with its reason", async () => {
    await renderInEnglish(
      <UploadRejectedFiles
        sourceKind="csv"
        rejectedFiles={[
          { name: "broken.csv", reason: "unparseable" },
          { name: "empty.csv", reason: "no_rows" },
        ]}
        fileCount={5}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "broken.csv could not be read",
      "empty.csv has no rows",
    ]);
  });

  it("counts against the rejected files alone when the file count is unknown", async () => {
    await renderInEnglish(
      <UploadRejectedFiles
        sourceKind="csv"
        rejectedFiles={[{ name: "broken.csv", reason: "unparseable" }]}
        fileCount={null}
      />,
    );

    expect(screen.getByText("1 of 1 file rejected")).toBeInTheDocument();
  });

  it("counts an Ambyte upload's rejected folders without the file total", async () => {
    await renderInEnglish(
      <UploadRejectedFiles
        sourceKind="ambyte"
        rejectedFiles={[{ name: "Ambyte_3", reason: "no_rows" }]}
        fileCount={840}
      />,
    );

    expect(screen.getByText("1 Ambyte folder left out")).toBeInTheDocument();
    expect(screen.queryByText(/files? rejected/)).not.toBeInTheDocument();
  });
});
