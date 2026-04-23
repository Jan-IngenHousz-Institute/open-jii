import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";
import type { ProtocolCell } from "@repo/api";

import { ProtocolPicker } from "./protocol-picker";

function renderPicker(onSelect = vi.fn<(cell: ProtocolCell) => void>()) {
  return {
    ...render(
      <ProtocolPicker onSelect={onSelect}>
        <button>Add Protocol</button>
      </ProtocolPicker>,
    ),
    onSelect,
  };
}

describe("ProtocolPicker", () => {
  it("opens the popover when the trigger button is clicked", async () => {
    const user = userEvent.setup();
    const protocols = [
      createProtocol({ id: "p1", name: "Photosynthesis v2", family: "multispeq" }),
    ];
    server.mount(contract.protocols.listProtocols, { body: protocols });

    renderPicker();

    await user.click(screen.getByRole("button", { name: /add protocol/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search protocols/i)).toBeInTheDocument();
    });
  });

  it("shows a list of protocols and selects one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const protocols = [
      createProtocol({ id: "p1", name: "Leaf Absorbance" }),
      createProtocol({ id: "p2", name: "SPAD Measurement" }),
    ];
    server.mount(contract.protocols.listProtocols, { body: protocols });

    renderPicker(onSelect);

    await user.click(screen.getByRole("button", { name: /add protocol/i }));

    await waitFor(() => {
      expect(screen.getByText("Leaf Absorbance")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Leaf Absorbance"));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.lastCall).toMatchObject([
      {
        type: "protocol",
        payload: {
          protocolId: "p1",
          name: "Leaf Absorbance",
        },
      },
    ]);
  });

  it("shows 'Create new protocol' button that opens create form", async () => {
    const user = userEvent.setup();
    server.mount(contract.protocols.listProtocols, { body: [] });

    renderPicker();

    await user.click(screen.getByRole("button", { name: /add protocol/i }));

    await waitFor(() => {
      expect(screen.getByText(/create new protocol/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/create new protocol/i));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/protocol name/i)).toBeInTheDocument();
    });
  });

  it("creates a new protocol and calls onSelect with the result", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const newProtocol = createProtocol({ id: "new-p1", name: "New Protocol" });

    server.mount(contract.protocols.listProtocols, { body: [] });
    server.mount(contract.protocols.createProtocol, { body: newProtocol, status: 201 });

    renderPicker(onSelect);

    await user.click(screen.getByRole("button", { name: /add protocol/i }));
    await waitFor(() => {
      expect(screen.getByText(/create new protocol/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/create new protocol/i));

    const nameInput = await screen.findByPlaceholderText(/protocol name/i);
    await user.type(nameInput, "New Protocol");

    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledOnce();
    });

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.lastCall).toMatchObject([
      {
        type: "protocol",
        payload: {
          protocolId: "new-p1",
        },
      },
    ]);
  });

  it("shows Back button to return to search from create form", async () => {
    const user = userEvent.setup();
    server.mount(contract.protocols.listProtocols, { body: [] });

    renderPicker();

    await user.click(screen.getByRole("button", { name: /add protocol/i }));
    await waitFor(() => {
      expect(screen.getByText(/create new protocol/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/create new protocol/i));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search protocols/i)).toBeInTheDocument();
    });
  });
});
