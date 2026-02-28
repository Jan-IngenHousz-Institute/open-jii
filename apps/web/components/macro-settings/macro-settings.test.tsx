import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { MacroSettings } from "./macro-settings";

const mockUseMacro = vi.fn();
vi.mock("../../hooks/macro/useMacro/useMacro", () => ({
  useMacro: (...args: [string]) => {
    mockUseMacro(...args);
    return mockUseMacro();
  },
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock MacroCompatibleProtocolsCard (added by protocol-macro compatibility feature)
vi.mock("./macro-compatible-protocols-card", () => ({
  MacroCompatibleProtocolsCard: ({ macroId }: { macroId: string }) => (
    <div data-testid="macro-compatible-protocols-card">{macroId}</div>
  ),
}));

// Mock child components
interface MockMacroDetailsCardProps {
  macroId: string;
  initialName: string;
  initialDescription: string;
  initialLanguage: string;
  initialCode: string;
}

interface MockMacroInfoCardProps {
  macroId: string;
  macro: { name: string };
}

vi.mock("./macro-details-card", () => ({
  MacroDetailsCard: (props: Record<string, unknown>) => (
    <div data-testid="macro-details-card" data-macro-id={props.macroId} />
  ),
}));
vi.mock("./macro-info-card", () => ({
  MacroInfoCard: (props: Record<string, unknown>) => (
    <div data-testid="macro-info-card" data-macro-id={props.macroId} />
  ),
}));

describe("MacroSettings", () => {
  it("shows loading then resolves to cards", async () => {
    const macro = createMacro({ id: "m-1", name: "Test Macro", description: "Desc" });
    server.mount(contract.macros.getMacro, { body: macro });

    render(<MacroSettings macroId="m-1" />);

    // Initially shows loading
    expect(screen.getByText("macroSettings.loading")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("macro-details-card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("macro-info-card")).toBeInTheDocument();
  });

  it("shows not-found when API returns 404", async () => {
    server.mount(contract.macros.getMacro, { status: 404 });

    render(<MacroSettings macroId="bad-id" />);

    await waitFor(() => {
      expect(screen.getByText("macroSettings.notFound")).toBeInTheDocument();
    });
  });

  it("passes macroId to child cards", async () => {
    const macro = createMacro({ id: "m-1" });
    server.mount(contract.macros.getMacro, { body: macro });

    render(<MacroSettings macroId="m-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("macro-details-card")).toHaveAttribute("data-macro-id", "m-1");
    });
    expect(screen.getByTestId("macro-info-card")).toHaveAttribute("data-macro-id", "m-1");
  });
});
