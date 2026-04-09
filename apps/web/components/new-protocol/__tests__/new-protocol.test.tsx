import { createMacro, createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, fireEvent, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";

import { NewProtocolForm } from "../new-protocol";

vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string) => [value, true],
}));

interface DropdownPropsCaptured {
  availableMacros: { id: string; name: string }[];
  value: string;
  placeholder: string;
  loading: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddMacro: (id: string) => void;
  isAddingMacro: boolean;
}
let lastDropdownProps: DropdownPropsCaptured | null = null;

vi.mock("../../macro-search-with-dropdown", () => ({
  MacroSearchWithDropdown: (props: DropdownPropsCaptured) => {
    lastDropdownProps = props;
    return <div data-testid="macro-search-dropdown" />;
  },
}));

// Supplement global @repo/ui/hooks mock with hooks needed by CodeTesterLayout (step 2)
vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
  useBreakpoint: () => ({ isMobile: false, isTablet: false, isLgTablet: false }),
  useIsMobile: () => false,
}));

// Mock ProtocolCodeEditor
vi.mock("../../protocol-code-editor", () => ({
  default: ({
    value,
    onChange,
    onValidationChange,
    title,
  }: {
    value: Record<string, unknown>[];
    onChange: (v: Record<string, unknown>[]) => void;
    onValidationChange: (v: boolean) => void;
    title?: string;
  }) => (
    <div data-testid="protocol-code-editor">
      {title && <span>{title}</span>}
      <textarea
        data-testid="code-editor"
        value={JSON.stringify(value)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value) as Record<string, unknown>[];
            onChange(parsed);
            onValidationChange(true);
          } catch {
            onValidationChange(false);
          }
        }}
      />
    </div>
  ),
}));

// Mock IotProtocolRunner
vi.mock("../../iot/iot-protocol-runner", () => ({
  IotProtocolRunner: () => <div data-testid="iot-protocol-runner">Protocol Runner</div>,
}));

// Mock useIotBrowserSupport
vi.mock("~/hooks/iot/useIotBrowserSupport", () => ({
  useIotBrowserSupport: () => ({
    bluetooth: true,
    serial: true,
    any: true,
    bluetoothReason: null,
    serialReason: null,
  }),
}));

describe("NewProtocolForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastDropdownProps = null;

    server.mount(contract.macros.listMacros, {
      body: [
        createMacro({ id: "macro-1", name: "SPAD Macro", language: "python" }),
        createMacro({ id: "macro-2", name: "Fluorescence Macro", language: "python" }),
      ],
    });
    server.mount(contract.protocols.createProtocol, {
      body: createProtocol({ id: "new-protocol-id", name: "Test Protocol" }),
    });
    server.mount(contract.protocols.addCompatibleMacros, { body: [] });
  });

  describe("Step 1 - Details", () => {
    it("should render the wizard with step indicators", () => {
      render(<NewProtocolForm />);

      // Step indicator should be visible (3 steps: Details, Code & Test, Review)
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("should render the details card on step 1", () => {
      render(<NewProtocolForm />);

      expect(screen.getByText("newProtocol.detailsTitle")).toBeInTheDocument();
      expect(screen.getByText("newProtocol.name")).toBeInTheDocument();
      expect(screen.getByText("newProtocol.family")).toBeInTheDocument();
      expect(screen.getByText("newProtocol.description_field")).toBeInTheDocument();
    });

    it("should render compatible macros section on step 1", () => {
      render(<NewProtocolForm />);

      expect(screen.getByText("newProtocol.compatibleMacros")).toBeInTheDocument();
      expect(screen.getByTestId("macro-search-dropdown")).toBeInTheDocument();
    });

    it("should show next and back buttons on step 1", () => {
      render(<NewProtocolForm />);

      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    it("should have back button disabled on step 1", () => {
      render(<NewProtocolForm />);

      const backButton = screen.getByRole("button", { name: /back/i });
      expect(backButton).toBeDisabled();
    });

    it("should pass available macros to the dropdown", async () => {
      render(<NewProtocolForm />);

      await waitFor(() => {
        expect(lastDropdownProps).not.toBeNull();
        const ids = lastDropdownProps?.availableMacros.map((m) => m.id);
        expect(ids).toContain("macro-1");
        expect(ids).toContain("macro-2");
      });
    });

    it("should add a macro when onAddMacro is called", async () => {
      render(<NewProtocolForm />);

      await waitFor(() => {
        expect(lastDropdownProps?.availableMacros.map((m) => m.id)).toContain("macro-1");
      });

      act(() => {
        lastDropdownProps?.onAddMacro("macro-1");
      });

      await waitFor(() => {
        expect(screen.getByText("SPAD Macro")).toBeInTheDocument();
      });
    });

    it("should filter out already-selected macros from available list", async () => {
      render(<NewProtocolForm />);

      await waitFor(() => {
        expect(lastDropdownProps?.availableMacros.map((m) => m.id)).toContain("macro-1");
      });

      act(() => {
        lastDropdownProps?.onAddMacro("macro-1");
      });

      await waitFor(() => {
        expect(lastDropdownProps?.availableMacros.map((m) => m.id)).not.toContain("macro-1");
        expect(lastDropdownProps?.availableMacros.map((m) => m.id)).toContain("macro-2");
      });
    });
  });

  describe("Step 2 - Code & Test", () => {
    const goToStep2 = async () => {
      const user = userEvent.setup();
      render(<NewProtocolForm />);

      // Fill in required name field
      const nameInput = screen.getByRole("textbox", { name: /newProtocol\.name/i });
      // fireEvent: controlled component (react-hook-form FormField) - userEvent.type fires per-character
      fireEvent.change(nameInput, { target: { value: "Test Protocol" } });

      // Click next to go to step 2
      const nextButton = screen.getByRole("button", { name: /next/i });
      await user.click(nextButton);

      // Wait for step 2 to render
      await waitFor(() => {
        expect(screen.getByTestId("protocol-code-editor")).toBeInTheDocument();
      });
      return user;
    };

    it("should show code editor and IoT tester on step 2", async () => {
      await goToStep2();

      expect(screen.getByTestId("protocol-code-editor")).toBeInTheDocument();
      expect(screen.getByTestId("iot-protocol-runner")).toBeInTheDocument();
    });

    it("should initialize code editor with default values", async () => {
      await goToStep2();

      const codeEditor = screen.getByTestId("code-editor");
      expect(codeEditor).toHaveValue(JSON.stringify([{}]));
    });

    it("should handle code editor changes", async () => {
      const user = await goToStep2();

      const codeEditor = screen.getByTestId("code-editor");
      const newCode = JSON.stringify([{ averages: 2 }]);

      // fireEvent: userEvent.type interprets curly braces as special keys
      fireEvent.change(codeEditor, { target: { value: newCode } });

      expect(codeEditor).toHaveValue(newCode);
    });

    it("should show next and back buttons on step 2", async () => {
      await goToStep2();

      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    it("should navigate back to step 1 when back is clicked", async () => {
      const user = await goToStep2();

      const backButton = screen.getByRole("button", { name: /back/i });
      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByText("newProtocol.detailsTitle")).toBeInTheDocument();
      });
    });
  });

  describe("Step 3 - Review", () => {
    const goToStep3 = async () => {
      const user = userEvent.setup();
      render(<NewProtocolForm />);

      // Fill in required name field
      const nameInput = screen.getByRole("textbox", { name: /newProtocol\.name/i });
      // fireEvent: controlled component (react-hook-form FormField) - userEvent.type fires per-character
      fireEvent.change(nameInput, { target: { value: "Test Protocol" } });

      // Step 1 → Step 2
      const nextButton1 = screen.getByRole("button", { name: /next/i });
      await user.click(nextButton1);

      await waitFor(() => {
        expect(screen.getByTestId("protocol-code-editor")).toBeInTheDocument();
      });

      // Step 2 → Step 3
      const nextButton2 = screen.getByRole("button", { name: /next/i });
      await user.click(nextButton2);

      await waitFor(() => {
        expect(screen.getByText("newProtocol.reviewYourProtocol")).toBeInTheDocument();
      });
      return user;
    };

    it("should show review content on step 3", async () => {
      await goToStep3();

      expect(screen.getByText("newProtocol.reviewYourProtocol")).toBeInTheDocument();
      expect(screen.getByText("newProtocol.protocolName")).toBeInTheDocument();
      expect(screen.getByText("newProtocol.protocolCode")).toBeInTheDocument();
      expect(screen.getByText("newProtocol.compatibleMacros")).toBeInTheDocument();
    });

    it("should show the protocol name in review", async () => {
      await goToStep3();

      expect(screen.getByText("Test Protocol")).toBeInTheDocument();
    });

    it("should show no macros message when none selected", async () => {
      await goToStep3();

      expect(screen.getByText("newProtocol.noMacrosAdded")).toBeInTheDocument();
    });

    it("should show submit and back buttons on step 3", async () => {
      await goToStep3();

      expect(screen.getByRole("button", { name: /finalizeSetup/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    it("should navigate back to step 2 when back is clicked", async () => {
      const user = await goToStep3();

      const backButton = screen.getByRole("button", { name: /back/i });
      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByTestId("protocol-code-editor")).toBeInTheDocument();
      });
    });

    it("should link compatible macros after create then navigate", async () => {
      const user = userEvent.setup();
      render(<NewProtocolForm />);

      act(() => {
        lastDropdownProps?.onAddMacro("macro-1");
      });

      const nameInput = screen.getByRole("textbox", { name: /newProtocol\.name/i });
      fireEvent.change(nameInput, { target: { value: "Test Protocol" } });

      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByTestId("protocol-code-editor")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText("newProtocol.reviewYourProtocol")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /finalizeSetup/i }));

      await waitFor(() => {
        expect(mockAddMacrosMutateAsync).toHaveBeenCalledWith({
          params: { id: "new-protocol-id" },
          body: { macroIds: ["macro-1"] },
        });
      });

      expect(mockPush).toHaveBeenCalledWith("/en/platform/protocols/new-protocol-id");
    });
  });
});
