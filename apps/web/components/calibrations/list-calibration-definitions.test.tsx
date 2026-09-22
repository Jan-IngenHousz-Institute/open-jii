import { OPEN_CALIBRATION_CREATE_EVENT } from "@/components/navigation/site-header/platform-header-events";
import { createCalibrationDefinition, createCalibrationDefinitionSummary } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, within } from "@/test/test-utils";
import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
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
    await userEvent.click(await screen.findByRole("option", { name: "Ambit" }));

    expect(screen.getByText("Factory bench")).toBeInTheDocument();
    expect(screen.queryByText("PAR bench")).toBeNull();
  });

  // The description is where a procedure says what it is for, so a search reads it too.
  it("narrows by name or description as the operator types", async () => {
    server.mount(contract.iot.listCalibrationDefinitions, {
      body: [
        createCalibrationDefinitionSummary({
          name: "PAR bench",
          description: "A lamp sweep against a reference sensor.",
        }),
        createCalibrationDefinitionSummary({
          name: "Factory bench",
          description: "A dark baseline of six channels.",
        }),
      ],
    });

    render(<ListCalibrationDefinitions />);
    await screen.findByText("PAR bench");

    await userEvent.type(
      screen.getByPlaceholderText("iot.calibration.library.searchPlaceholder"),
      "baseline",
    );

    expect(screen.getByText("Factory bench")).toBeInTheDocument();
    expect(screen.queryByText("PAR bench")).toBeNull();

    await userEvent.type(
      screen.getByPlaceholderText("iot.calibration.library.searchPlaceholder"),
      " of nothing",
    );
    expect(screen.getByText("iot.calibration.library.noMatches")).toBeInTheDocument();
  });

  // Creating one opens it: nothing stands between the author and the page they write it
  // on, and a definition cannot exist without a procedure, script and schema anyway. The
  // action itself sits in the page header and arrives here as an event.
  it("creates a calibration on the header's event and opens it", async () => {
    server.mount(contract.iot.listCalibrationDefinitions, { body: [] });
    const created = createCalibrationDefinition({ name: "Untitled calibration" });
    const spy = server.mount(contract.iot.createCalibrationDefinition, {
      status: 201,
      body: created,
    });

    render(<ListCalibrationDefinitions />);
    expect(await screen.findByText("iot.calibration.library.empty")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event(OPEN_CALIBRATION_CREATE_EVENT));
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ name: "Untitled calibration", family: "minipar" });
    });
    // The starter has to satisfy the contract's required artefacts on its own.
    expect(spy.body).toHaveProperty("captureProcedure");
    expect(spy.body).toHaveProperty("outputSchema");
    const router = useRouter();
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(`/en-US/platform/calibrations/${created.id}`);
    });
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
