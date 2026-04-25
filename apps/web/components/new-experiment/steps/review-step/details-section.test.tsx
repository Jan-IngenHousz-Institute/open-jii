import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import type { CreateExperimentBody } from "@repo/api/schemas/experiment.schema";

import { DetailsSection } from "./details-section";

describe("DetailsSection", () => {
  const onEdit = vi.fn();
  const baseFormData: CreateExperimentBody = {
    name: "Test Experiment",
    description: "",
    visibility: "public",
    members: [],
    locations: [],
    workbookId: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the experiment name and a dash for workbook when none selected", () => {
    render(<DetailsSection formData={baseFormData} onEdit={onEdit} />);

    expect(screen.getByText("Test Experiment")).toBeInTheDocument();
    // workbook row shows em-dash when no workbook selected
    const dashes = screen.getAllByText("\u2014");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("shows em-dashes when name is empty and no workbook", () => {
    render(<DetailsSection formData={{ ...baseFormData, name: "" }} onEdit={onEdit} />);
    const dashes = screen.getAllByText("\u2014");
    expect(dashes.length).toBe(2);
  });

  it("fetches and shows workbook name when workbookId is set", async () => {
    const wb = createWorkbook({ id: "wb-1", name: "My Workbook" });
    server.mount(contract.workbooks.getWorkbook, { body: wb });

    render(<DetailsSection formData={{ ...baseFormData, workbookId: "wb-1" }} onEdit={onEdit} />);

    await waitFor(() => {
      expect(screen.getByText("My Workbook")).toBeInTheDocument();
    });
  });

  it("calls onEdit when the user clicks the edit button", async () => {
    const user = userEvent.setup();
    render(<DetailsSection formData={baseFormData} onEdit={onEdit} />);

    await user.click(screen.getByText("common.edit"));

    expect(onEdit).toHaveBeenCalledOnce();
  });
});
