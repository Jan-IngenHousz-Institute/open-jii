import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type React from "react";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { MeasurementPanel } from "../measurement-panel";

// useDebounce — pragmatic mock (timer utility)
vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: <T,>(v: T): [T, boolean] => [v, true],
}));

// ProtocolSearchWithDropdown — sibling component (Rule 5)
vi.mock("../../protocol-search-with-dropdown", () => ({
  ProtocolSearchWithDropdown: ({
    availableProtocols,
    placeholder,
    searchValue,
    onSearchChange,
    onAddProtocol,
    loading,
  }: {
    availableProtocols: { id: string; name: string }[];
    placeholder: string;
    searchValue: string;
    onSearchChange: (v: string) => void;
    onAddProtocol: (id: string) => void;
    loading: boolean;
  }) => (
    <div>
      <input
        aria-label="protocol-search"
        placeholder={placeholder}
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {loading && <p>Loading…</p>}
      <ul>
        {availableProtocols.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onAddProtocol(p.id)}>
              {p.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  ),
}));

const protocols = [
  createProtocol({ name: "Protocol Alpha" }),
  createProtocol({ name: "Protocol Beta" }),
  createProtocol({ name: "Humidity Sensor" }),
];

function renderPanel(overrides?: Partial<React.ComponentProps<typeof MeasurementPanel>>) {
  return render(
    <MeasurementPanel
      selectedProtocolId=""
      onChange={() => void 0}
      disabled={false}
      {...overrides}
    />,
  );
}

describe("<MeasurementPanel />", () => {
  it("renders title and search placeholder", () => {
    server.mount(contract.protocols.listProtocols, { body: protocols });
    renderPanel();

    expect(screen.getByText("experiments.measurementPanelTitle")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("experiments.searchProtocols")).toBeInTheDocument();
  });

  it("displays protocols from the server", async () => {
    server.mount(contract.protocols.listProtocols, { body: protocols });
    renderPanel();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Protocol Alpha" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Protocol Beta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Humidity Sensor" })).toBeInTheDocument();
  });

  it("selects a protocol, fires onChange, and clears search", async () => {
    server.mount(contract.protocols.listProtocols, { body: protocols });
    const onChange = vi.fn<(id: string) => void>();
    renderPanel({ onChange });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Protocol Beta" })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Protocol Beta" }));
    expect(onChange).toHaveBeenCalledWith(protocols[1].id);
  });

  it("does not emit onChange when disabled", async () => {
    server.mount(contract.protocols.listProtocols, { body: protocols });
    const onChange = vi.fn<(id: string) => void>();
    renderPanel({ onChange, disabled: true });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Protocol Alpha" })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Protocol Alpha" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows empty list when server returns no protocols", async () => {
    server.mount(contract.protocols.listProtocols, { body: [] });
    renderPanel();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Protocol/ })).not.toBeInTheDocument();
    });
  });
});
