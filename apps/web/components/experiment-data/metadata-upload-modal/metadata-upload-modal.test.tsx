import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { MetadataUploadModal } from "./metadata-upload-modal";

describe("MetadataUploadModal", () => {
  it("caps the dialog height and scrolls it, so a tall preview keeps the footer reachable", async () => {
    server.mount(contract.experiments.listExperimentMetadata, { body: [] });
    server.mount(contract.experiments.getFlow, { status: 404 });

    render(<MetadataUploadModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    expect(await screen.findByRole("dialog")).toHaveClass("max-h-[80vh]", "overflow-y-auto");
  });
});
