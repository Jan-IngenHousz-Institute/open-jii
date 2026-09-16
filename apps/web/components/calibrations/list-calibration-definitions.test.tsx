import { createCalibrationDefinitionSummary } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { ListCalibrationDefinitions } from "./list-calibration-definitions";

describe("ListCalibrationDefinitions", () => {
  // A name is one version line: every version stays readable because runs record the
  // version they ran, but the library is a list of procedures, not of versions.
  it("shows one row per procedure, at its newest version", async () => {
    server.mount(contract.iot.listCalibrationDefinitions, {
      body: [
        createCalibrationDefinitionSummary({ name: "PAR bench", family: "minipar", version: 1 }),
        createCalibrationDefinitionSummary({ name: "PAR bench", family: "minipar", version: 2 }),
        createCalibrationDefinitionSummary({ name: "Factory bench", family: "ambit", version: 1 }),
      ],
    });

    render(<ListCalibrationDefinitions />);

    expect(await screen.findByText("PAR bench")).toBeInTheDocument();
    expect(screen.getByText("Factory bench")).toBeInTheDocument();
    // Two versions of one name, one row.
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("narrows to one device family", async () => {
    server.mount(contract.iot.listCalibrationDefinitions, {
      body: [
        createCalibrationDefinitionSummary({ name: "PAR bench", family: "minipar" }),
        createCalibrationDefinitionSummary({ name: "Factory bench", family: "ambit" }),
      ],
    });

    render(<ListCalibrationDefinitions />);
    await screen.findByText("PAR bench");

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "ambit" }));

    expect(screen.getByText("Factory bench")).toBeInTheDocument();
    expect(screen.queryByText("PAR bench")).toBeNull();
  });

  it("offers a way to write a new one", async () => {
    server.mount(contract.iot.listCalibrationDefinitions, { body: [] });

    render(<ListCalibrationDefinitions />);

    expect(await screen.findByText("iot.calibration.library.empty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /library.create/ })).toHaveAttribute(
      "href",
      "/en-US/platform/calibrations/new",
    );
  });

  it("says so when the list could not be read", async () => {
    server.mount(contract.iot.listCalibrationDefinitions, { status: 500 });

    render(<ListCalibrationDefinitions />);

    expect(await screen.findByText("iot.calibration.loadError")).toBeInTheDocument();
  });

  it("links a row to the newest version of its line", async () => {
    const newest = createCalibrationDefinitionSummary({ name: "PAR bench", version: 4 });
    server.mount(contract.iot.listCalibrationDefinitions, {
      body: [createCalibrationDefinitionSummary({ name: "PAR bench", version: 3 }), newest],
    });

    render(<ListCalibrationDefinitions />);

    await screen.findByText("PAR bench");
    const row = within(screen.getByRole("table")).getByRole("link", { name: "PAR bench" });
    expect(row).toHaveAttribute("href", `/en-US/platform/calibrations/${newest.id}`);
  });
});
