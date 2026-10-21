import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { UploadRejectedFiles } from "./upload-rejected-files";

// The shared mock drops interpolation values, and the counts and names are the point here.
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: "en-US" },
  }),
}));

describe("UploadRejectedFiles", () => {
  it("counts the rejected files against every file in the upload", () => {
    render(
      <UploadRejectedFiles
        sourceKind="csv"
        rejectedFiles={[
          { name: "broken.csv", reason: "unparseable" },
          { name: "empty.csv", reason: "no_rows" },
        ]}
        fileCount={5}
      />,
    );

    expect(
      screen.getByText('experimentData.uploadDataModal.rejectedFiles {"rejected":2,"count":5}'),
    ).toBeInTheDocument();
  });

  it("names each rejected file with its reason", () => {
    render(
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
      'experimentData.uploadDataModal.rejectionReasons.unparseable {"name":"broken.csv"}',
      'experimentData.uploadDataModal.rejectionReasons.no_rows {"name":"empty.csv"}',
    ]);
  });

  it("counts against the rejected files alone when the file count is unknown", () => {
    render(
      <UploadRejectedFiles
        sourceKind="csv"
        rejectedFiles={[{ name: "broken.csv", reason: "unparseable" }]}
        fileCount={null}
      />,
    );

    expect(
      screen.getByText('experimentData.uploadDataModal.rejectedFiles {"rejected":1,"count":1}'),
    ).toBeInTheDocument();
  });

  it("counts an Ambyte upload's rejected folders without the file total", () => {
    render(
      <UploadRejectedFiles
        sourceKind="ambyte"
        rejectedFiles={[{ name: "Ambyte_3", reason: "no_rows" }]}
        fileCount={840}
      />,
    );

    expect(
      screen.getByText('experimentData.uploadDataModal.rejectedAmbyteFolders {"count":1}'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/uploadDataModal\.rejectedFiles/)).not.toBeInTheDocument();
  });
});
