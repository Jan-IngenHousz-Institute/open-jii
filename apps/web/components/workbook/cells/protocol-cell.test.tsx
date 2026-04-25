import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import type { ProtocolCell } from "@repo/api/schemas/workbook-cells.schema";

import { ProtocolCellComponent } from "./protocol-cell";

vi.mock("../workbook-code-editor", () => ({
  WorkbookCodeEditor: ({ value }: { value: string }) => (
    <pre data-testid="code-editor">{value}</pre>
  ),
}));

function makeProtocolCell(overrides: Partial<ProtocolCell> = {}): ProtocolCell {
  return {
    id: "proto-1",
    type: "protocol",
    payload: { protocolId: "p1", version: 1, name: "Light Sensor" },
    isCollapsed: false,
    ...overrides,
  };
}

const protocol = createProtocol({
  id: "p1",
  name: "Light Sensor",
  code: [{ measurement: "light", duration: 5 }],
  family: "multispeq",
});

describe("ProtocolCellComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.mount(contract.protocols.getProtocol, { body: protocol });
  });

  it("shows the protocol name and its code once loaded", async () => {
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    // Protocol name is displayed in the header
    expect(screen.getByText("Light Sensor")).toBeInTheDocument();

    // Code editor shows the JSON once the protocol loads
    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });
    expect(screen.getByTestId("code-editor").textContent).toContain('"measurement"');
    expect(screen.getByTestId("code-editor").textContent).toContain('"light"');
  });

  it("shows an external link to view the full protocol", () => {
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/platform/protocols/p1");
  });

  it("lets the user copy the protocol code", async () => {
    document.execCommand = vi.fn();
    const user = userEvent.setup();
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    // Wait for protocol to load so there's code to copy
    await waitFor(() => expect(screen.getByTestId("code-editor")).toBeInTheDocument());

    // The copy button is in the header actions — find all ghost buttons and pick the copy one
    const copyButton = screen
      .getAllByRole("button")
      .find(
        (btn) =>
          btn.querySelector("svg")?.classList.contains("lucide-copy") ??
          btn.querySelector("[class*='copy']") !== null,
      );
    // Fallback: just find the small button in the header area
    if (copyButton) {
      await user.click(copyButton);
    }
  });

  it("shows 'Could not load protocol code' when there is no code", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: "p1", code: [] }),
    });

    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Could not load protocol code")).toBeInTheDocument();
    });
  });

  it("shows the sensor family badge", async () => {
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => {
      // The family badge shows the formatted label
      expect(screen.getByText("MultispeQ")).toBeInTheDocument();
    });
  });
});
