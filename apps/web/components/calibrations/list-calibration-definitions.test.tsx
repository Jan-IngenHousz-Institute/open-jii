import { createCalibrationDefinitionSummary } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { ListCalibrationDefinitions } from "./list-calibration-definitions";

describe("ListCalibrationDefinitions", () => {
  it("lists the procedures with their family and version", async () => {
    server.mount(contract.iot.listCalibrationDefinitions, {
      body: [
        createCalibrationDefinitionSummary({ name: "PAR bench", family: "minipar", version: 3 }),
        createCalibrationDefinitionSummary({ name: "Factory bench", family: "ambit", version: 1 }),
      ],
    });

    render(<ListCalibrationDefinitions />);

    expect(await screen.findByText("PAR bench")).toBeInTheDocument();
    expect(screen.getByText("Factory bench")).toBeInTheDocument();
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

  it("opens a procedure from its row", async () => {
    const definition = createCalibrationDefinitionSummary({ name: "PAR bench" });
    server.mount(contract.iot.listCalibrationDefinitions, { body: [definition] });

    render(<ListCalibrationDefinitions />);

    await screen.findByText("PAR bench");
    const link = within(screen.getByRole("table")).getByRole("link", { name: "PAR bench" });
    expect(link).toHaveAttribute("href", `/en-US/platform/calibrations/${definition.id}`);
  });
});
