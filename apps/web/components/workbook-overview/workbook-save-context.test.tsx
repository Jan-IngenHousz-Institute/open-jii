import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { WorkbookSaveProvider, useWorkbookSaveStatus } from "./workbook-save-context";

/** Test harness that exposes context values and action buttons */
function TestConsumer() {
  const { isSaving, isDirty, markDirty, markSaving, markSaved } = useWorkbookSaveStatus();
  return (
    <div>
      <span data-testid="isSaving">{String(isSaving)}</span>
      <span data-testid="isDirty">{String(isDirty)}</span>
      <button onClick={markDirty}>markDirty</button>
      <button onClick={markSaving}>markSaving</button>
      <button onClick={markSaved}>markSaved</button>
    </div>
  );
}

function renderContext() {
  return render(
    <WorkbookSaveProvider>
      <TestConsumer />
    </WorkbookSaveProvider>,
  );
}

describe("WorkbookSaveContext", () => {
  it("starts with isSaving=false and isDirty=false", () => {
    renderContext();
    expect(screen.getByTestId("isSaving").textContent).toBe("false");
    expect(screen.getByTestId("isDirty").textContent).toBe("false");
  });

  it("markDirty sets isDirty to true", async () => {
    const user = userEvent.setup();
    renderContext();
    await user.click(screen.getByText("markDirty"));
    expect(screen.getByTestId("isDirty").textContent).toBe("true");
    expect(screen.getByTestId("isSaving").textContent).toBe("false");
  });

  it("markSaving sets isSaving to true", async () => {
    const user = userEvent.setup();
    renderContext();
    await user.click(screen.getByText("markSaving"));
    expect(screen.getByTestId("isSaving").textContent).toBe("true");
  });

  it("markSaved clears both isSaving and isDirty", async () => {
    const user = userEvent.setup();
    renderContext();
    await user.click(screen.getByText("markDirty"));
    await user.click(screen.getByText("markSaving"));
    expect(screen.getByTestId("isSaving").textContent).toBe("true");
    expect(screen.getByTestId("isDirty").textContent).toBe("true");

    await user.click(screen.getByText("markSaved"));
    expect(screen.getByTestId("isSaving").textContent).toBe("false");
    expect(screen.getByTestId("isDirty").textContent).toBe("false");
  });
});
