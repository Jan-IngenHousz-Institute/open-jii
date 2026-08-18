import { buildExportFilename } from "./export-filename";

describe("buildExportFilename", () => {
  const base = {
    experimentName: "My Experiment",
    experimentId: "11111111-2222-3333-4444-555555555555",
    tableName: "clean_data",
    exportId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    filePath: "/volumes/catalog/centrum/data-exports/exp/clean_data/csv/id/clean_data.csv",
    completedAt: "2026-01-02T03:04:05Z",
  };

  it("joins experiment, table and timestamp", () => {
    expect(buildExportFilename(base)).toBe("my-experiment_clean-data_20260102_030405.csv");
  });

  it("slugifies punctuation and collapses separators", () => {
    expect(buildExportFilename({ ...base, experimentName: "  Trial #7: Light/Dark (v2)!  " })).toBe(
      "trial-7-light-dark-v2_clean-data_20260102_030405.csv",
    );
  });

  it("keeps accented letters readable", () => {
    expect(buildExportFilename({ ...base, experimentName: "Höhe Grün Étude" })).toBe(
      "hohe-grun-etude_clean-data_20260102_030405.csv",
    );
  });

  it("transliterates letters that NFKD leaves whole", () => {
    expect(buildExportFilename({ ...base, experimentName: "Straße Ølsen Łódź" })).toBe(
      "strasse-olsen-lodz_clean-data_20260102_030405.csv",
    );
  });

  it("caps overly long experiment names", () => {
    const name = "a".repeat(120);
    const filename = buildExportFilename({ ...base, experimentName: name });

    expect(filename.startsWith(`${"a".repeat(60)}_`)).toBe(true);
  });

  it("falls back to the experiment id when the name has nothing usable", () => {
    expect(buildExportFilename({ ...base, experimentName: "###" })).toBe(
      `${base.experimentId}_clean-data_20260102_030405.csv`,
    );
  });

  it("omits the table segment when the table name is unknown", () => {
    expect(buildExportFilename({ ...base, tableName: "" })).toBe(
      "my-experiment_20260102_030405.csv",
    );
  });

  it("falls back to the export id when the timestamp is missing or unparsable", () => {
    expect(buildExportFilename({ ...base, completedAt: null })).toBe(
      `my-experiment_clean-data_${base.exportId}.csv`,
    );
    expect(buildExportFilename({ ...base, completedAt: "not-a-date" })).toBe(
      `my-experiment_clean-data_${base.exportId}.csv`,
    );
  });

  it("reads the extension from the file name, not from path segments", () => {
    expect(buildExportFilename({ ...base, filePath: "/a.b/c/d/part-00000" })).toBe(
      "my-experiment_clean-data_20260102_030405",
    );
    expect(buildExportFilename({ ...base, filePath: "" })).toBe(
      "my-experiment_clean-data_20260102_030405",
    );
    expect(buildExportFilename({ ...base, filePath: "/exports/data.XLSX" })).toBe(
      "my-experiment_clean-data_20260102_030405.xlsx",
    );
  });

  it("handles the export layouts the data task writes", () => {
    const layouts = [
      ["/Volumes/c/centrum/data-exports/e/clean_data/csv/id/part-00000-abc.c000.csv", ".csv"],
      ["/Volumes/c/centrum/data-exports/e/clean_data/json/id/part-00000.json", ".json"],
      ["/Volumes/c/centrum/data-exports/e/clean_data/parquet/id/part-00000.parquet", ".parquet"],
      ["/Volumes/c/centrum/data-exports/e/clean_data/xlsx/id/clean_data.xlsx", ".xlsx"],
    ];

    for (const [filePath, expected] of layouts) {
      expect(buildExportFilename({ ...base, filePath })).toBe(
        `my-experiment_clean-data_20260102_030405${expected}`,
      );
    }
  });
});
