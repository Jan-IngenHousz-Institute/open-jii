import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";

import { ProtocolCompatibleMacrosCard } from "../protocol-compatible-macros-card";

vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string, _delay: number) => [value, true],
}));

// Capture props passed to MacroSearchWithDropdown
interface DropdownPropsCaptured {
  availableMacros: { id: string; name: string }[];
  value: string;
  placeholder: string;
  loading: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddMacro: (id: string) => void | Promise<void>;
  isAddingMacro: boolean;
}
let lastDropdownProps: DropdownPropsCaptured | null = null;

vi.mock("../../macro-search-with-dropdown", () => ({
  MacroSearchWithDropdown: (props: DropdownPropsCaptured) => {
    lastDropdownProps = props;
    return <div data-testid="macro-dropdown" />;
  },
}));

const PROTO_ID = "00000000-0000-0000-0000-000000000001";
const MACRO_ID_1 = "00000000-0000-0000-0000-000000000010";
const MACRO_ID_2 = "00000000-0000-0000-0000-000000000020";
const MACRO_ID_3 = "00000000-0000-0000-0000-000000000030";
const CREATOR_ID = "00000000-0000-0000-0000-000000000099";

const defaultCompatibleMacros = [
  {
    protocolId: PROTO_ID,
    macro: {
      id: MACRO_ID_1,
      name: "Temperature Plot",
      filename: "temp.py",
      language: "python" as const,
      createdBy: CREATOR_ID,
    },
    addedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    protocolId: PROTO_ID,
    macro: {
      id: MACRO_ID_2,
      name: "Humidity Analysis",
      filename: "humid.r",
      language: "r" as const,
      createdBy: CREATOR_ID,
    },
    addedAt: "2024-01-01T00:00:00.000Z",
  },
];

describe("<ProtocolCompatibleMacrosCard />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastDropdownProps = null;

    server.mount(contract.protocols.listCompatibleMacros, {
      body: defaultCompatibleMacros,
    });
    server.mount(contract.protocols.addCompatibleMacros, { body: [] });
    server.mount(contract.protocols.removeCompatibleMacro, {});
    server.mount(contract.macros.listMacros, {
      body: [
        createMacro({ id: MACRO_ID_1, name: "Temperature Plot", language: "python" }),
        createMacro({ id: MACRO_ID_2, name: "Humidity Analysis", language: "r" }),
        createMacro({ id: MACRO_ID_3, name: "Statistical Summary", language: "javascript" }),
      ],
    });
  });

  it("should show loading state", () => {
    server.mount(contract.protocols.listCompatibleMacros, { body: [], delay: 999_999 });

    render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("should show 'no compatible macros' when list is empty", async () => {
    server.mount(contract.protocols.listCompatibleMacros, { body: [] });

    render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("protocolSettings.noCompatibleMacros")).toBeInTheDocument();
    });
  });

  it("should render linked macros with names and language", async () => {
    render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Temperature Plot")).toBeInTheDocument();
    });
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("Humidity Analysis")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
  });

  it("should render macro links with correct hrefs", async () => {
    render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Temperature Plot")).toBeInTheDocument();
    });

    const links = screen.getAllByRole("link");
    const macro1Links = links.filter((l) => l.getAttribute("href")?.includes(MACRO_ID_1));
    expect(macro1Links.length).toBeGreaterThan(0);
    expect(macro1Links[0]).toHaveAttribute("href", `/en-US/platform/macros/${MACRO_ID_1}`);
  });

  it("should call remove mutation when X button is clicked", async () => {
    const removeSpy = server.mount(contract.protocols.removeCompatibleMacro, {});

    render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Temperature Plot")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button");
    await userEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(removeSpy.callCount).toBe(1);
    });
    expect(removeSpy.params).toMatchObject({ id: PROTO_ID, macroId: MACRO_ID_1 });
  });

  it("should call remove mutation for specific macro when its X button is clicked", async () => {
    const removeSpy = server.mount(contract.protocols.removeCompatibleMacro, {});

    render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Humidity Analysis")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button");
    await userEvent.click(removeButtons[1]);

    await waitFor(() => {
      expect(removeSpy.callCount).toBe(1);
    });
    expect(removeSpy.params).toMatchObject({ id: PROTO_ID, macroId: MACRO_ID_2 });
  });

  it("should pass correct props to MacroSearchWithDropdown (filters out already-linked macros)", async () => {
    render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} />);

    await waitFor(() => {
      expect(lastDropdownProps).not.toBeNull();
      const availableIds = lastDropdownProps?.availableMacros.map((m) => m.id);
      expect(availableIds).toContain(MACRO_ID_3);
      expect(availableIds).not.toContain(MACRO_ID_1);
      expect(availableIds).not.toContain(MACRO_ID_2);
    });
  });

  it("should render card title and description", async () => {
    render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("protocolSettings.compatibleMacros")).toBeInTheDocument();
    });
    expect(screen.getByText("protocolSettings.compatibleMacrosDescription")).toBeInTheDocument();
  });

  it("should call add mutation when a macro is added via the dropdown", async () => {
    const addSpy = server.mount(contract.protocols.addCompatibleMacros, { body: [] });

    render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} />);

    await waitFor(() => {
      expect(lastDropdownProps).not.toBeNull();
    });

    await lastDropdownProps?.onAddMacro(MACRO_ID_3);

    await waitFor(() => {
      expect(addSpy.callCount).toBe(1);
    });
    expect(addSpy.body).toMatchObject({
      macroIds: [MACRO_ID_3],
    });
    expect(addSpy.params).toMatchObject({ id: PROTO_ID });
  });

  it("should pass isAdding state to MacroSearchWithDropdown", async () => {
    server.mount(contract.protocols.addCompatibleMacros, { body: [], delay: 999_999 });

    render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} />);

    await waitFor(() => {
      expect(lastDropdownProps).not.toBeNull();
    });

    // Trigger the add without awaiting so it stays pending
    void lastDropdownProps?.onAddMacro(MACRO_ID_3);

    await waitFor(() => {
      expect(lastDropdownProps?.isAddingMacro).toBe(true);
    });
  });

  it("should disable remove buttons while removal is pending", async () => {
    server.mount(contract.protocols.removeCompatibleMacro, { delay: 999_999 });

    render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Temperature Plot")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button");
    // Click a remove button to trigger the pending state
    await userEvent.click(removeButtons[0]);

    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      for (const btn of buttons) {
        expect(btn).toBeDisabled();
      }
    });
  });

  describe("embedded mode", () => {
    it("should render in embedded mode without Card wrapper", async () => {
      render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} embedded />);

      await waitFor(() => {
        expect(screen.getByText("Temperature Plot")).toBeInTheDocument();
      });
      expect(screen.getByText("protocolSettings.compatibleMacros")).toBeInTheDocument();
    });

    it("should render title and description in embedded mode", async () => {
      render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} embedded />);

      await waitFor(() => {
        expect(screen.getByText("protocolSettings.compatibleMacros")).toBeInTheDocument();
      });
      expect(screen.getByText("protocolSettings.compatibleMacrosDescription")).toBeInTheDocument();
    });

    it("should render compatible macros list in embedded mode", async () => {
      render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} embedded />);

      await waitFor(() => {
        expect(screen.getByText("Temperature Plot")).toBeInTheDocument();
      });
      expect(screen.getByText("Humidity Analysis")).toBeInTheDocument();
    });

    it("should render the macro search dropdown in embedded mode", async () => {
      render(<ProtocolCompatibleMacrosCard protocolId={PROTO_ID} embedded />);

      await waitFor(() => {
        expect(screen.getByTestId("macro-dropdown")).toBeInTheDocument();
      });
    });
  });
});
