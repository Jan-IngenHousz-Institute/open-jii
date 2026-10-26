import { useActivity } from "@/components/activity/activity-context";
import { createUpload } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { UploadTransferList } from "./upload-transfer-list";

const UPLOAD_ID = "8c1f6a0e-4c35-4d7e-9a43-3f0b2a5d1e77";

function TransferListWithTransfer() {
  const { upsert } = useActivity();
  const now = new Date().toISOString();

  const startTransfer = () =>
    upsert({
      id: UPLOAD_ID,
      kind: "data_upload",
      title: "leaf_traits",
      status: "running",
      experimentId: "exp-1",
      createdAt: now,
      updatedAt: now,
    });

  return (
    <>
      <button onClick={startTransfer}>start</button>
      <UploadTransferList experimentId="exp-1" enabled />
    </>
  );
}

describe("UploadTransferList", () => {
  it("shows a transfer the history does not list yet", async () => {
    server.mount(contract.experiments.listUploads, { body: { uploads: [] } });

    render(<TransferListWithTransfer />);
    act(() => screen.getByText("start").click());

    expect(
      await screen.findByText("experimentData.uploadDataModal.transfer.statusUploading"),
    ).toBeInTheDocument();
  });

  it("hands over to the history card once the history lists the same upload", async () => {
    server.mount(contract.experiments.listUploads, {
      body: { uploads: [createUpload({ uploadId: UPLOAD_ID, status: "receiving" })] },
    });

    render(<TransferListWithTransfer />);
    act(() => screen.getByText("start").click());

    await waitFor(() => {
      expect(
        screen.queryByText("experimentData.uploadDataModal.transfer.statusUploading"),
      ).not.toBeInTheDocument();
    });
  });

  it("renders nothing without transfers", () => {
    server.mount(contract.experiments.listUploads, { body: { uploads: [] } });

    const { container } = render(<UploadTransferList experimentId="exp-1" enabled />);

    expect(container).toBeEmptyDOMElement();
  });
});
