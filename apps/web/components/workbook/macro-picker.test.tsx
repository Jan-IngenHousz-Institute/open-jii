import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";
import type { MacroCell } from "@repo/api";

import { MacroPicker } from "./macro-picker";

function renderPicker(onSelect = vi.fn<(cell: MacroCell) => void>()) {
  return {
    ...render(
      <MacroPicker onSelect={onSelect}>
        <button>Add Macro</button>
      </MacroPicker>,
    ),
    onSelect,
  };
}

describe("MacroPicker", () => {
  it("opens the popover and shows macro list", async () => {
    const user = userEvent.setup();
    const macros = [createMacro({ id: "m1", name: "Data Processor", language: "python" })];
    server.mount(contract.macros.listMacros, { body: macros });

    renderPicker();

    await user.click(screen.getByRole("button", { name: /add macro/i }));

    await waitFor(() => {
      expect(screen.getByText("Data Processor")).toBeInTheDocument();
    });
  });

  it("selects a macro and calls onSelect with a MacroCell", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const macros = [createMacro({ id: "m1", name: "NDVI Calculator", language: "python" })];
    server.mount(contract.macros.listMacros, { body: macros });

    renderPicker(onSelect);

    await user.click(screen.getByRole("button", { name: /add macro/i }));

    await waitFor(() => {
      expect(screen.getByText("NDVI Calculator")).toBeInTheDocument();
    });

    await user.click(screen.getByText("NDVI Calculator"));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.lastCall).toMatchObject([
      {
        type: "macro",
        payload: {
          macroId: "m1",
          language: "python",
          name: "NDVI Calculator",
        },
      },
    ]);
  });

  it("shows create form when user clicks 'Create new macro'", async () => {
    const user = userEvent.setup();
    server.mount(contract.macros.listMacros, { body: [] });

    renderPicker();

    await user.click(screen.getByRole("button", { name: /add macro/i }));

    await waitFor(() => {
      expect(screen.getByText(/create new macro/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/create new macro/i));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/macro name/i)).toBeInTheDocument();
    });
  });

  it("creates a new macro and calls onSelect with the result", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const newMacro = createMacro({ id: "new-m1", name: "New Macro", language: "python" });

    server.mount(contract.macros.listMacros, { body: [] });
    server.mount(contract.macros.createMacro, { body: newMacro, status: 201 });

    renderPicker(onSelect);

    await user.click(screen.getByRole("button", { name: /add macro/i }));
    await waitFor(() => {
      expect(screen.getByText(/create new macro/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/create new macro/i));

    const nameInput = await screen.findByPlaceholderText(/macro name/i);
    await user.type(nameInput, "New Macro");

    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledOnce();
    });

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.lastCall).toMatchObject([
      {
        type: "macro",
        payload: {
          macroId: "new-m1",
        },
      },
    ]);
  });

  it("navigates back from create form to search", async () => {
    const user = userEvent.setup();
    server.mount(contract.macros.listMacros, { body: [] });

    renderPicker();

    await user.click(screen.getByRole("button", { name: /add macro/i }));
    await waitFor(() => {
      expect(screen.getByText(/create new macro/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/create new macro/i));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search macros/i)).toBeInTheDocument();
    });
  });
});
