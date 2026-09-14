import { server } from "@/test/msw/server";
import { render, screen, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { ExperimentDataInventory } from "./experiment-data-inventory";

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";

const tables = [
  {
    identifier: "raw_data",
    tableType: "static" as const,
    displayName: "Raw Data",
    totalRows: 128402,
  },
  {
    identifier: "3f1a",
    tableType: "macro" as const,
    displayName: "Processed Data (Chlorophyll fit)",
    totalRows: 41110,
  },
  {
    identifier: "field_notes",
    tableType: "upload" as const,
    displayName: "field-notes-sept",
    totalRows: 1,
  },
];

describe("ExperimentDataInventory", () => {
  it("lists every table the experiment holds, by name and size", async () => {
    server.mount(contract.experiments.getExperimentTables, { body: tables });

    render(<ExperimentDataInventory experimentId={EXPERIMENT_ID} />);

    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("Raw Data")).toBeInTheDocument();
    expect(within(rows[2]).getByText("field-notes-sept")).toBeInTheDocument();
  });

  it("drops the backend's wrapper around a macro table's name", async () => {
    server.mount(contract.experiments.getExperimentTables, { body: tables });

    render(<ExperimentDataInventory experimentId={EXPERIMENT_ID} />);

    const rows = await screen.findAllByRole("listitem");
    expect(within(rows[1]).getByText("Chlorophyll fit")).toBeInTheDocument();
    expect(within(rows[1]).queryByText(/Processed Data/)).not.toBeInTheDocument();
  });

  it("groups the row count for readability rather than printing a bare integer", async () => {
    server.mount(contract.experiments.getExperimentTables, { body: [tables[0]] });

    render(<ExperimentDataInventory experimentId={EXPERIMENT_ID} />);

    expect(await screen.findByText(/128,402/)).toBeInTheDocument();
  });

  it("says an experiment holds nothing yet instead of showing an empty frame", async () => {
    server.mount(contract.experiments.getExperimentTables, { body: [] });

    render(<ExperimentDataInventory experimentId={EXPERIMENT_ID} />);

    expect(await screen.findByText("dataInventory.emptyTitle")).toBeInTheDocument();
    // Nothing to see, so the link that would promise otherwise stays away.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("distinguishes a failed read from an experiment with no data", async () => {
    server.mount(contract.experiments.getExperimentTables, { status: 500 });

    render(<ExperimentDataInventory experimentId={EXPERIMENT_ID} />);

    expect(await screen.findByText("dataInventory.loadError")).toBeInTheDocument();
    expect(screen.queryByText("dataInventory.emptyTitle")).not.toBeInTheDocument();
  });

  it("sends an active experiment to its own Data tab", async () => {
    server.mount(contract.experiments.getExperimentTables, { body: tables });

    render(<ExperimentDataInventory experimentId={EXPERIMENT_ID} />);

    expect(await screen.findByRole("link", { name: "dataInventory.seeAll" })).toHaveAttribute(
      "href",
      `/en-US/platform/experiments/${EXPERIMENT_ID}/data`,
    );
  });

  it("keeps an archived experiment inside the archive", async () => {
    server.mount(contract.experiments.getExperimentTables, { body: tables });

    render(<ExperimentDataInventory experimentId={EXPERIMENT_ID} isArchived />);

    expect(await screen.findByRole("link", { name: "dataInventory.seeAll" })).toHaveAttribute(
      "href",
      `/en-US/platform/experiments-archive/${EXPERIMENT_ID}/data`,
    );
  });
});
