import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import type { ProtocolCell } from "@repo/api/schemas/workbook-cells.schema";
import { useSession } from "@repo/auth/client";

import { ProtocolCellComponent } from "./protocol-cell";

vi.mock("../workbook-code-editor", () => ({
  WorkbookCodeEditor: ({
    value,
    onChange,
    readOnly,
  }: {
    value: string;
    onChange?: (v: string) => void;
    readOnly?: boolean;
  }) => (
    <div data-testid="code-editor-wrapper" data-readonly={String(!!readOnly)}>
      <pre data-testid="code-editor">{value}</pre>
      {onChange && (
        <button
          data-testid="simulate-change"
          onClick={() => onChange('[{"measurement":"new","duration":10}]')}
        >
          change
        </button>
      )}
    </div>
  ),
}));

const mockedUseSession = vi.mocked(useSession);

const OWNER_ID = "owner-user-id";

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
    mockedUseSession.mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
    server.mount(contract.protocols.getProtocol, { body: protocol });
  });

  it("shows the protocol name and its code once loaded", async () => {
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(screen.getByText("Light Sensor")).toBeInTheDocument();

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

    await waitFor(() => expect(screen.getByTestId("code-editor")).toBeInTheDocument());

    const copyButton = screen
      .getAllByRole("button")
      .find(
        (btn) =>
          btn.querySelector("svg")?.classList.contains("lucide-copy") ??
          btn.querySelector("[class*='copy']") !== null,
      );
    if (copyButton) {
      await user.click(copyButton);
    }
  });

  it("renders an empty array as an editable editor for newly-created protocols", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: "p1", code: [] }),
    });

    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByTestId("code-editor")).toBeInTheDocument());
    expect(screen.getByTestId("code-editor").textContent).toBe("[]");
    expect(screen.queryByText("Could not load protocol code")).not.toBeInTheDocument();
  });

  it("shows the sensor family badge", async () => {
    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText("MultispeQ")).toBeInTheDocument();
    });
  });

  it("renders the editor read-only when the viewer is not the protocol owner", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: "p1", code: [{ measurement: "light" }], createdBy: "someone" }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: "viewer" } },
      isPending: false,
    } as ReturnType<typeof useSession>);

    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "true");
    });
    expect(screen.queryByTestId("simulate-change")).not.toBeInTheDocument();
  });

  it("renders the editor as editable when the viewer owns the protocol", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);

    render(
      <ProtocolCellComponent cell={makeProtocolCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "false");
    });
    expect(screen.getByTestId("simulate-change")).toBeInTheDocument();
  });

  it("forces the editor read-only regardless of ownership when readOnly prop is set", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: "p1", code: [{ measurement: "light" }], createdBy: OWNER_ID }),
    });
    mockedUseSession.mockReturnValue({
      data: { user: { id: OWNER_ID } },
      isPending: false,
    } as ReturnType<typeof useSession>);

    render(
      <ProtocolCellComponent
        cell={makeProtocolCell()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        readOnly
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("code-editor-wrapper")).toHaveAttribute("data-readonly", "true");
    });
  });
});
