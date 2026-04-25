import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderWithForm, screen, waitFor, userEvent } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import type { CreateExperimentBody } from "@repo/api/schemas/experiment.schema";
import { contract } from "@repo/api/contract";

import { NewExperimentDetailsCard } from "./new-experiment-details-card";

function renderCard(workbooks = [createWorkbook({ id: "wb-1", name: "Field Study Workbook" })]) {
  server.mount(contract.workbooks.listWorkbooks, { body: workbooks });

  return renderWithForm<CreateExperimentBody>((form) => <NewExperimentDetailsCard form={form} />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        workbookId: undefined,
      },
    },
  });
}

describe("NewExperimentDetailsCard", () => {
  it("renders the name input and allows the user to type a name", async () => {
    const user = userEvent.setup();
    renderCard();

    const nameInput = screen.getByRole("textbox", { name: /name/i });
    await user.type(nameInput, "Spring Trial 2025");

    expect(nameInput).toHaveValue("Spring Trial 2025");
  });

  it("renders a workbook selector with available workbooks", async () => {
    const user = userEvent.setup();
    renderCard([
      createWorkbook({ id: "wb-1", name: "Photosynthesis Workbook" }),
      createWorkbook({ id: "wb-2", name: "Chlorophyll Workbook" }),
    ]);

    // Wait for workbooks to load from MSW
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    // Open the select
    await user.click(screen.getByRole("combobox"));

    await waitFor(() => {
      expect(screen.getByText("Photosynthesis Workbook")).toBeInTheDocument();
      expect(screen.getByText("Chlorophyll Workbook")).toBeInTheDocument();
    });
  });

  it("shows a 'No workbook' option in the workbook selector", async () => {
    const user = userEvent.setup();
    renderCard();

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("combobox"));

    await waitFor(() => {
      // t() returns the key in tests; multiple elements because Select renders in trigger + list
      const matches = screen.getAllByText("newExperiment.noWorkbook");
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("allows user to select a workbook from the dropdown", async () => {
    const user = userEvent.setup();
    renderCard([createWorkbook({ id: "wb-1", name: "Selected Workbook" })]);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("combobox"));

    await waitFor(() => {
      expect(screen.getByText("Selected Workbook")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Selected Workbook"));

    // After selection, the combobox should show the selected value
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("Selected Workbook");
    });
  });
});
