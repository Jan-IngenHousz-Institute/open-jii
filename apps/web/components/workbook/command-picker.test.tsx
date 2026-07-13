import { createCommand } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { CommandCell } from "@repo/api/schemas/workbook-cells.schema";

import { CommandPicker } from "./command-picker";

function renderPicker(onSelect = vi.fn<(cell: CommandCell) => void>()) {
  return {
    ...render(
      <CommandPicker onSelect={onSelect}>
        <button>Add Command</button>
      </CommandPicker>,
    ),
    onSelect,
  };
}

describe("CommandPicker", () => {
  it("opens the popover when the trigger button is clicked", async () => {
    const user = userEvent.setup();
    const commands = [createCommand({ id: "p1", name: "Photosynthesis v2", family: "multispeq" })];
    server.mount(contract.commands.listCommands, { body: commands });

    renderPicker();

    await user.click(screen.getByRole("button", { name: /add command/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search commands/i)).toBeInTheDocument();
    });
  });

  it("shows a list of commands and selects one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const commands = [
      createCommand({ id: "p1", name: "Leaf Absorbance" }),
      createCommand({ id: "p2", name: "SPAD Measurement" }),
    ];
    server.mount(contract.commands.listCommands, { body: commands });

    renderPicker(onSelect);

    await user.click(screen.getByRole("button", { name: /add command/i }));

    await waitFor(() => {
      expect(screen.getByText("Leaf Absorbance")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Leaf Absorbance"));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.lastCall).toMatchObject([
      {
        type: "command",
        payload: {
          commandId: "p1",
          name: "Leaf Absorbance",
        },
      },
    ]);
  });

  it("shows 'Create new command' button that opens create form", async () => {
    const user = userEvent.setup();
    server.mount(contract.commands.listCommands, { body: [] });

    renderPicker();

    await user.click(screen.getByRole("button", { name: /add command/i }));

    await waitFor(() => {
      expect(screen.getByText(/create new command/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/create new command/i));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/command name/i)).toBeInTheDocument();
    });
  });

  it("creates a new command and calls onSelect with the result", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const newCommand = createCommand({ id: "new-p1", name: "New Command" });

    server.mount(contract.commands.listCommands, { body: [] });
    server.mount(contract.commands.createCommand, { body: newCommand, status: 201 });

    renderPicker(onSelect);

    await user.click(screen.getByRole("button", { name: /add command/i }));
    await waitFor(() => {
      expect(screen.getByText(/create new command/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/create new command/i));

    const nameInput = await screen.findByPlaceholderText(/command name/i);
    await user.type(nameInput, "New Command");

    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledOnce();
    });

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.lastCall).toMatchObject([
      {
        type: "command",
        payload: {
          commandId: "new-p1",
        },
      },
    ]);
  });

  it("shows Back button to return to search from create form", async () => {
    const user = userEvent.setup();
    server.mount(contract.commands.listCommands, { body: [] });

    renderPicker();

    await user.click(screen.getByRole("button", { name: /add command/i }));
    await waitFor(() => {
      expect(screen.getByText(/create new command/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/create new command/i));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search commands/i)).toBeInTheDocument();
    });
  });
});
