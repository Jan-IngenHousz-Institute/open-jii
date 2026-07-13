import { createCommand } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";

import { MacroCompatibleCommandsCard } from "../macro-compatible-commands-card";

vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string, _delay: number) => [value, true],
}));

// Capture props passed to CommandSearchWithDropdown
interface DropdownPropsCaptured {
  availableCommands: { id: string; name: string }[];
  value: string;
  placeholder: string;
  loading: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddCommand: (id: string) => void | Promise<void>;
  isAddingCommand: boolean;
}
let lastDropdownProps: DropdownPropsCaptured | null = null;

vi.mock("../../command-search-with-dropdown", () => ({
  CommandSearchWithDropdown: (props: DropdownPropsCaptured) => {
    lastDropdownProps = props;
    return <div data-testid="command-dropdown" />;
  },
}));

const MACRO_ID = "macro-1";
const PROTO_1_ID = "00000000-0000-0000-0000-000000000010";
const PROTO_2_ID = "00000000-0000-0000-0000-000000000020";
const PROTO_3_ID = "00000000-0000-0000-0000-000000000030";
const CREATOR_ID = "00000000-0000-0000-0000-000000000099";

const mockCompatibleCommands = [
  {
    macroId: "00000000-0000-0000-0000-000000000001",
    command: {
      id: PROTO_1_ID,
      name: "Temperature Command",
      family: "multispeq",
      createdBy: CREATOR_ID,
    },
    addedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    macroId: "00000000-0000-0000-0000-000000000001",
    command: {
      id: PROTO_2_ID,
      name: "Humidity Command",
      family: "ambyte",
      createdBy: CREATOR_ID,
    },
    addedAt: "2024-01-01T00:00:00.000Z",
  },
];

const mockAllCommands = [
  createCommand({ id: PROTO_1_ID, name: "Temperature Command", family: "multispeq" }),
  createCommand({ id: PROTO_2_ID, name: "Humidity Command", family: "ambyte" }),
  createCommand({ id: PROTO_3_ID, name: "Light Command", family: "multispeq" }),
];

describe("<MacroCompatibleCommandsCard />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastDropdownProps = null;

    server.mount(contract.macros.listCompatibleCommands, {
      body: mockCompatibleCommands,
    });
    server.mount(contract.macros.addCompatibleCommands, {
      body: [],
    });
    server.mount(contract.macros.removeCompatibleCommand, {});
    server.mount(contract.commands.listCommands, {
      body: mockAllCommands,
    });
  });

  it("should show loading state", () => {
    server.mount(contract.macros.listCompatibleCommands, { body: [], delay: 999_999 });

    render(<MacroCompatibleCommandsCard macroId={MACRO_ID} />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("should show 'no compatible commands' when list is empty", async () => {
    server.mount(contract.macros.listCompatibleCommands, { body: [] });

    render(<MacroCompatibleCommandsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("macroSettings.noCompatibleCommands")).toBeInTheDocument();
    });
  });

  it("should render linked commands with names and family", async () => {
    render(<MacroCompatibleCommandsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Temperature Command")).toBeInTheDocument();
    });
    expect(screen.getByText("multispeq")).toBeInTheDocument();
    expect(screen.getByText("Humidity Command")).toBeInTheDocument();
    expect(screen.getByText("ambyte")).toBeInTheDocument();
  });

  it("should render command links with correct hrefs", async () => {
    render(<MacroCompatibleCommandsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Temperature Command")).toBeInTheDocument();
    });

    const links = screen.getAllByRole("link");
    const proto1Links = links.filter((l) => l.getAttribute("href")?.includes(PROTO_1_ID));
    expect(proto1Links.length).toBeGreaterThan(0);
    expect(proto1Links[0]).toHaveAttribute("href", `/en-US/platform/commands/${PROTO_1_ID}`);
  });

  it("should call remove mutation when X button is clicked", async () => {
    const spy = server.mount(contract.macros.removeCompatibleCommand, {});

    render(<MacroCompatibleCommandsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Temperature Command")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button");
    await userEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(spy.callCount).toBe(1);
    });
    expect(spy.params).toEqual({ id: MACRO_ID, commandId: PROTO_1_ID });
  });

  it("should call remove mutation for specific command when its X button is clicked", async () => {
    const spy = server.mount(contract.macros.removeCompatibleCommand, {});

    render(<MacroCompatibleCommandsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Humidity Command")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button");
    await userEvent.click(removeButtons[1]);

    await waitFor(() => {
      expect(spy.callCount).toBe(1);
    });
    expect(spy.params).toEqual({ id: MACRO_ID, commandId: PROTO_2_ID });
  });

  it("should pass correct props to CommandSearchWithDropdown (filters out already-linked commands)", async () => {
    render(<MacroCompatibleCommandsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(lastDropdownProps).not.toBeNull();
      expect(lastDropdownProps?.availableCommands.length).toBeGreaterThan(0);
    });

    // proto-1 and proto-2 are already linked, so only proto-3 should be available
    const availableIds = lastDropdownProps?.availableCommands.map((p) => p.id);
    expect(availableIds).toContain(PROTO_3_ID);
    expect(availableIds).not.toContain(PROTO_1_ID);
    expect(availableIds).not.toContain(PROTO_2_ID);
  });

  it("should render card title and description", () => {
    render(<MacroCompatibleCommandsCard macroId={MACRO_ID} />);

    expect(screen.getByText("macroSettings.compatibleCommands")).toBeInTheDocument();
    expect(screen.getByText("macroSettings.compatibleCommandsDescription")).toBeInTheDocument();
  });

  it("should call add mutation when a command is added via the dropdown", async () => {
    const spy = server.mount(contract.macros.addCompatibleCommands, { body: [] });

    render(<MacroCompatibleCommandsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(lastDropdownProps).not.toBeNull();
    });

    // Simulate adding a command via the dropdown callback
    await lastDropdownProps?.onAddCommand(PROTO_3_ID);

    await waitFor(() => {
      expect(spy.callCount).toBe(1);
    });
    expect(spy.params).toEqual({ id: MACRO_ID });
    expect(spy.body).toEqual({ commandIds: [PROTO_3_ID] });
  });

  it("should pass isAdding state to CommandSearchWithDropdown", async () => {
    server.mount(contract.macros.addCompatibleCommands, { body: [], delay: 999_999 });

    render(<MacroCompatibleCommandsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(lastDropdownProps).not.toBeNull();
      expect(lastDropdownProps?.availableCommands.length).toBeGreaterThan(0);
    });

    // Trigger the add (it will hang due to delay) -- don't await the promise
    void lastDropdownProps?.onAddCommand(PROTO_3_ID);

    await waitFor(() => {
      expect(lastDropdownProps?.isAddingCommand).toBe(true);
    });
  });

  it("should disable remove buttons while removal is pending", async () => {
    server.mount(contract.macros.removeCompatibleCommand, { delay: 999_999 });

    render(<MacroCompatibleCommandsCard macroId={MACRO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Temperature Command")).toBeInTheDocument();
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
      render(<MacroCompatibleCommandsCard macroId={MACRO_ID} embedded />);

      // In embedded mode, content renders directly without Card wrapper
      expect(screen.getByText("macroSettings.compatibleCommands")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText("Temperature Command")).toBeInTheDocument();
      });
    });

    it("should render title and description in embedded mode", () => {
      render(<MacroCompatibleCommandsCard macroId={MACRO_ID} embedded />);

      expect(screen.getByText("macroSettings.compatibleCommands")).toBeInTheDocument();
      expect(screen.getByText("macroSettings.compatibleCommandsDescription")).toBeInTheDocument();
    });

    it("should render compatible commands list in embedded mode", async () => {
      render(<MacroCompatibleCommandsCard macroId={MACRO_ID} embedded />);

      await waitFor(() => {
        expect(screen.getByText("Temperature Command")).toBeInTheDocument();
      });
      expect(screen.getByText("Humidity Command")).toBeInTheDocument();
    });

    it("should render the command search dropdown in embedded mode", () => {
      render(<MacroCompatibleCommandsCard macroId={MACRO_ID} embedded />);

      expect(screen.getByTestId("command-dropdown")).toBeInTheDocument();
    });
  });
});
