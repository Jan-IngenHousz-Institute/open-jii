import { createCommand } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type React from "react";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { MeasurementPanel } from "../measurement-panel";

vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: <T,>(v: T): [T, boolean] => [v, true],
}));

vi.mock("../../command-search-with-dropdown", () => ({
  CommandSearchWithDropdown: ({
    availableCommands,
    placeholder,
    searchValue,
    onSearchChange,
    onAddCommand,
    loading,
  }: {
    availableCommands: { id: string; name: string }[];
    placeholder: string;
    searchValue: string;
    onSearchChange: (v: string) => void;
    onAddCommand: (id: string) => void;
    loading: boolean;
  }) => (
    <div>
      <input
        aria-label="command-search"
        placeholder={placeholder}
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {loading && <p>Loading…</p>}
      <ul>
        {availableCommands.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onAddCommand(p.id)}>
              {p.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  ),
}));

const commands = [
  createCommand({ name: "Command Alpha" }),
  createCommand({ name: "Command Beta" }),
  createCommand({ name: "Humidity Sensor" }),
];

function renderPanel(overrides?: Partial<React.ComponentProps<typeof MeasurementPanel>>) {
  return render(
    <MeasurementPanel
      selectedCommandId=""
      onChange={() => void 0}
      disabled={false}
      {...overrides}
    />,
  );
}

describe("<MeasurementPanel />", () => {
  it("renders title and search placeholder", () => {
    server.mount(contract.commands.listCommands, { body: commands });
    renderPanel();

    expect(screen.getByText("experiments.measurementPanelTitle")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("experiments.searchCommands")).toBeInTheDocument();
  });

  it("displays commands from the server", async () => {
    server.mount(contract.commands.listCommands, { body: commands });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Command Alpha" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Command Beta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Humidity Sensor" })).toBeInTheDocument();
  });

  it("selects a command, fires onChange, and clears search", async () => {
    server.mount(contract.commands.listCommands, { body: commands });
    const onChange = vi.fn<(id: string) => void>();
    renderPanel({ onChange });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Command Beta" })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Command Beta" }));
    expect(onChange).toHaveBeenCalledWith(commands[1].id);
  });

  it("does not emit onChange when disabled", async () => {
    server.mount(contract.commands.listCommands, { body: commands });
    const onChange = vi.fn<(id: string) => void>();
    renderPanel({ onChange, disabled: true });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Command Alpha" })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Command Alpha" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows empty list when server returns no commands", async () => {
    server.mount(contract.commands.listCommands, { body: [] });
    renderPanel();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Command/ })).not.toBeInTheDocument();
    });
  });
});
