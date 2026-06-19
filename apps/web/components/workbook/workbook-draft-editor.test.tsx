import { AutosaveStatusProvider } from "@/components/shared/autosave/autosave-status-context";
import { render } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { WorkbookDraftEditor } from "./workbook-draft-editor";

const { updateMock } = vi.hoisted(() => ({
  updateMock: vi.fn((_id: string, _props?: unknown) => ({ mutateAsync: vi.fn() })),
}));

vi.mock("@repo/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "u1" } } }),
}));

vi.mock("@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate", () => ({
  useWorkbookUpdate: (id: string, props?: unknown) => updateMock(id, props),
}));

vi.mock("@/hooks/workbook/useWorkbookExecution/useWorkbookExecution", () => ({
  useWorkbookExecution: () => ({
    isConnected: false,
    isConnecting: false,
    deviceInfo: undefined,
    sensorFamily: "multispeq",
    setSensorFamily: vi.fn(),
    connectionType: "serial",
    setConnectionType: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    executionStates: {},
    isRunningAll: false,
    runCell: vi.fn(),
    runAll: vi.fn(),
    stopExecution: vi.fn(),
    clearOutputs: vi.fn(),
  }),
}));

vi.mock("@/components/workbook/workbook-editor", () => ({
  WorkbookEditor: () => <div data-testid="workbook-editor" />,
}));

describe("WorkbookDraftEditor", () => {
  it("passes onSaved through to the autosave mutation so saves auto-apply", () => {
    const onSaved = vi.fn();
    render(
      <AutosaveStatusProvider>
        <WorkbookDraftEditor
          id="wb-1"
          initialCells={[]}
          createdBy="u1"
          name="WB"
          onSaved={onSaved}
        />
      </AutosaveStatusProvider>,
    );

    expect(updateMock).toHaveBeenCalledWith("wb-1", { onSuccess: onSaved });
  });
});
