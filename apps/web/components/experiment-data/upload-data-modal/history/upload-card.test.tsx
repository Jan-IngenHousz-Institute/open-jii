import { createUpload } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { UploadCard } from "./upload-card";

describe("UploadCard", () => {
  it("titles the card with the upload table's name", () => {
    render(<UploadCard upload={createUpload({ uploadTableName: "leaf_traits" })} index={1} />);

    expect(screen.getByText("leaf_traits")).toBeInTheDocument();
    expect(
      screen.queryByText("experimentData.uploadDataModal.history.uploadTitle"),
    ).not.toBeInTheDocument();
  });

  it("numbers an upload that has no table name", () => {
    render(<UploadCard upload={createUpload({ uploadTableName: null })} index={3} />);

    expect(
      screen.getByText("experimentData.uploadDataModal.history.uploadTitle"),
    ).toBeInTheDocument();
  });

  it("lists the source kind, rows and files", () => {
    render(
      <UploadCard
        upload={createUpload({ sourceKind: "tsv", rowCount: 1234, fileCount: 3 })}
        index={1}
      />,
    );

    expect(screen.getByText("experimentData.uploadDataModal.sourceKind.tsv")).toBeInTheDocument();
    expect(screen.getByText("experimentData.uploadDataModal.history.rowCount")).toBeInTheDocument();
    expect(
      screen.getByText("experimentData.uploadDataModal.history.fileCount"),
    ).toBeInTheDocument();
  });

  it("leaves out the rows and files it does not know", () => {
    render(<UploadCard upload={createUpload({ rowCount: null, fileCount: null })} index={1} />);

    expect(
      screen.queryByText("experimentData.uploadDataModal.history.rowCount"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("experimentData.uploadDataModal.history.fileCount"),
    ).not.toBeInTheDocument();
  });

  it("says why an upload failed", () => {
    render(
      <UploadCard
        upload={createUpload({ status: "failed", errorCode: "transfer_interrupted" })}
        index={1}
      />,
    );

    expect(screen.getByText("experimentData.uploadDataModal.status.failed")).toBeInTheDocument();
    expect(
      screen.getByText("experimentData.uploadDataModal.errors.transfer_interrupted"),
    ).toBeInTheDocument();
  });

  it("gives the unknown reason for a failure without an error code", () => {
    render(<UploadCard upload={createUpload({ status: "failed", errorCode: null })} index={1} />);

    expect(screen.getByText("experimentData.uploadDataModal.errors.unknown")).toBeInTheDocument();
  });

  it("gives no failure reason for an upload that has not failed", () => {
    render(<UploadCard upload={createUpload({ status: "running" })} index={1} />);

    expect(screen.queryByText(/uploadDataModal\.errors\./)).not.toBeInTheDocument();
  });

  it("lists the files a completed upload rejected", () => {
    render(
      <UploadCard
        upload={createUpload({
          status: "completed",
          fileCount: 5,
          rejectedFiles: [
            { name: "broken.csv", reason: "unparseable" },
            { name: "empty.csv", reason: "no_rows" },
          ],
        })}
        index={1}
      />,
    );

    expect(screen.getByText("experimentData.uploadDataModal.rejectedFiles")).toBeInTheDocument();
    expect(
      screen.getByText("experimentData.uploadDataModal.rejectionReasons.unparseable"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("experimentData.uploadDataModal.rejectionReasons.no_rows"),
    ).toBeInTheDocument();
  });

  it("counts an Ambyte upload's rejections in folders, not files", () => {
    render(
      <UploadCard
        upload={createUpload({
          sourceKind: "ambyte",
          status: "completed",
          fileCount: 840,
          rejectedFiles: [{ name: "Ambyte_3", reason: "unparseable" }],
        })}
        index={1}
      />,
    );

    expect(
      screen.getByText("experimentData.uploadDataModal.rejectedAmbyteFolders"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("experimentData.uploadDataModal.rejectedFiles"),
    ).not.toBeInTheDocument();
  });

  it("shows no rejected files when every file was accepted", () => {
    render(<UploadCard upload={createUpload({ rejectedFiles: [] })} index={1} />);

    expect(
      screen.queryByText("experimentData.uploadDataModal.rejectedFiles"),
    ).not.toBeInTheDocument();
  });
});
