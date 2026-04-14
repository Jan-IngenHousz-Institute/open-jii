import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";

import { MacroCompatibleProtocolsCard } from "../macro-compatible-protocols-card";

vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string, _delay: number) => [value, true],
}));

// Capture props passed to ProtocolSearchWithDropdown
interface DropdownPropsCaptured {
  availableProtocols: { id: string; name: string }[];
  value: string;
  placeholder: string;
  loading: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddProtocol: (id: string) => void | Promise<void>;
  isAddingProtocol: boolean;
}
let lastDropdownProps: DropdownPropsCaptured | null = null;

vi.mock("../../protocol-search-with-dropdown", () => ({
  ProtocolSearchWithDropdown: (props: DropdownPropsCaptured) => {
    lastDropdownProps = props;
    return <div data-testid="protocol-dropdown" />;
  },
}));

const MACRO_ID = "macro-1";
const PROTO_1_ID = "00000000-0000-0000-0000-000000000010";
const PROTO_2_ID = "00000000-0000-0000-0000-000000000020";
const PROTO_3_ID = "00000000-0000-0000-0000-000000000030";
const CREATOR_ID = "00000000-0000-0000-0000-000000000099";

const mockCompatibleProtocols = [
  {
    macroId: "00000000-0000-0000-0000-000000000001",
    protocol: {
      id: PROTO_1_ID,
      name: "Temperature Protocol",
      family: "multispeq",
      createdBy: CREATOR_ID,
    },
    addedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    macroId: "00000000-0000-0000-0000-000000000001",
    protocol: { id: PROTO_2_ID, name: "Humidity Protocol", family: "ambit", createdBy: CREATOR_ID },
    addedAt: "2024-01-01T00:00:00.000Z",
  },
];

const mockAllProtocols = [
  createProtocol({ id: PROTO_1_ID, name: "Temperature Protocol", family: "multispeq" }),
  createProtocol({ id: PROTO_2_ID, name: "Humidity Protocol", family: "ambit" }),
  createProtocol({ id: PROTO_3_ID, name: "Light Protocol", family: "multispeq" }),
];

describe("<MacroCompatibleProtocolsCard />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastDropdownProps = null;

    server.mount(contract.macros.listCompatibleProtocols, {
      body: mockCompatibleProtocols,
    });
    server.mount(contract.macros.addCompatibleProtocols, {
      body: [],
    });
    server.mount(contract.macros.removeCompatibleProtocol, {});
    server.mount(contract.protocols.listProtocols, {
      body: mockAllProtocols,
    });
  });

  it("should show loading state", () => {
    server.mount(contract.macros.listCompatibleProtocols, { body: [], delay: 999_999 });

    render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("should show 'no compatible protocols' when list is empty", async () => {
    server.mount(contract.macros.listCompatibleProtocols, { body: [] });

    render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("macroSettings.noCompatibleProtocols")).toBeInTheDocument();
    });
  });

  it("should render linked protocols with names and family", async () => {
    render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Temperature Protocol")).toBeInTheDocument();
    });
    expect(screen.getByText("multispeq")).toBeInTheDocument();
    expect(screen.getByText("Humidity Protocol")).toBeInTheDocument();
    expect(screen.getByText("ambit")).toBeInTheDocument();
  });

  it("should render protocol links with correct hrefs", async () => {
    render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Temperature Protocol")).toBeInTheDocument();
    });

    const links = screen.getAllByRole("link");
    const proto1Links = links.filter((l) => l.getAttribute("href")?.includes(PROTO_1_ID));
    expect(proto1Links.length).toBeGreaterThan(0);
    expect(proto1Links[0]).toHaveAttribute("href", `/en-US/platform/protocols/${PROTO_1_ID}`);
  });

  it("should call remove mutation when X button is clicked", async () => {
    const spy = server.mount(contract.macros.removeCompatibleProtocol, {});

    render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Temperature Protocol")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button");
    await userEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(spy.callCount).toBe(1);
    });
    expect(spy.params).toEqual({ id: MACRO_ID, protocolId: PROTO_1_ID });
  });

  it("should call remove mutation for specific protocol when its X button is clicked", async () => {
    const spy = server.mount(contract.macros.removeCompatibleProtocol, {});

    render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Humidity Protocol")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button");
    await userEvent.click(removeButtons[1]);

    await waitFor(() => {
      expect(spy.callCount).toBe(1);
    });
    expect(spy.params).toEqual({ id: MACRO_ID, protocolId: PROTO_2_ID });
  });

  it("should pass correct props to ProtocolSearchWithDropdown (filters out already-linked protocols)", async () => {
    render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(lastDropdownProps).not.toBeNull();
      expect(lastDropdownProps!.availableProtocols.length).toBeGreaterThan(0);
    });

    // proto-1 and proto-2 are already linked, so only proto-3 should be available
    const availableIds = lastDropdownProps?.availableProtocols.map((p) => p.id);
    expect(availableIds).toContain(PROTO_3_ID);
    expect(availableIds).not.toContain(PROTO_1_ID);
    expect(availableIds).not.toContain(PROTO_2_ID);
  });

  it("should render card title and description", () => {
    render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} />);

    expect(screen.getByText("macroSettings.compatibleProtocols")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.compatibleProtocolsDescription")).toBeInTheDocument();
  });

  it("should call add mutation when a protocol is added via the dropdown", async () => {
    const spy = server.mount(contract.macros.addCompatibleProtocols, { body: [] });

    render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(lastDropdownProps).not.toBeNull();
    });

    // Simulate adding a protocol via the dropdown callback
    await lastDropdownProps?.onAddProtocol(PROTO_3_ID);

    await waitFor(() => {
      expect(spy.callCount).toBe(1);
    });
    expect(spy.params).toEqual({ id: MACRO_ID });
    expect(spy.body).toEqual({ protocolIds: [PROTO_3_ID] });
  });

  it("should pass isAdding state to ProtocolSearchWithDropdown", async () => {
    server.mount(contract.macros.addCompatibleProtocols, { body: [], delay: 999_999 });

    render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(lastDropdownProps).not.toBeNull();
      expect(lastDropdownProps!.availableProtocols.length).toBeGreaterThan(0);
    });

    // Trigger the add (it will hang due to delay) — don't await the promise
    lastDropdownProps?.onAddProtocol(PROTO_3_ID);

    await waitFor(() => {
      expect(lastDropdownProps?.isAddingProtocol).toBe(true);
    });
  });

  it("should disable remove buttons while removal is pending", async () => {
    server.mount(contract.macros.removeCompatibleProtocol, { delay: 999_999 });

    render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Temperature Protocol")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button");
    await userEvent.click(removeButtons[0]);

    await waitFor(() => {
      for (const btn of screen.getAllByRole("button")) {
        expect(btn).toBeDisabled();
      }
    });
  });

  describe("embedded mode", () => {
    it("should render in embedded mode without Card wrapper", async () => {
      render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} embedded />);

      // In embedded mode, content renders directly without Card wrapper
      expect(screen.getByText("macroSettings.compatibleProtocols")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText("Temperature Protocol")).toBeInTheDocument();
      });
    });

    it("should render title and description in embedded mode", () => {
      render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} embedded />);

      expect(screen.getByText("macroSettings.compatibleProtocols")).toBeInTheDocument();
      expect(screen.getByText("macroSettings.compatibleProtocolsDescription")).toBeInTheDocument();
    });

    it("should render compatible protocols list in embedded mode", async () => {
      render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} embedded />);

      await waitFor(() => {
        expect(screen.getByText("Temperature Protocol")).toBeInTheDocument();
      });
      expect(screen.getByText("Humidity Protocol")).toBeInTheDocument();
    });

    it("should render the protocol search dropdown in embedded mode", () => {
      render(<MacroCompatibleProtocolsCard macroId={MACRO_ID} embedded />);

      expect(screen.getByTestId("protocol-dropdown")).toBeInTheDocument();
    });
  });
});
