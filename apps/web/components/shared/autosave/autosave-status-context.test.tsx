import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { AutosaveDisplayStatus } from "./autosave-status-context";
import {
  AutosaveStatusProvider,
  useAutosaveStatus,
  useReportAutosaveStatus,
} from "./autosave-status-context";

function Reporter({ status }: { status: AutosaveDisplayStatus }) {
  useReportAutosaveStatus({ status, error: null, hasUnsavedChanges: true });
  return null;
}

function Status() {
  const report = useAutosaveStatus();
  return <output>{JSON.stringify(report)}</output>;
}

describe("AutosaveStatusProvider", () => {
  it("clears an invalid draft and its unsaved flag when the editor unmounts", () => {
    const { rerender } = render(
      <AutosaveStatusProvider>
        <Reporter status="invalid" />
        <Status />
      </AutosaveStatusProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent('"status":"invalid"');

    rerender(
      <AutosaveStatusProvider>
        <Status />
      </AutosaveStatusProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      JSON.stringify({ status: null, error: null, hasUnsavedChanges: false }),
    );
  });

  it("does not clear a newer reporter when an older editor unmounts", () => {
    const { rerender } = render(
      <AutosaveStatusProvider>
        <Reporter key="older" status="invalid" />
        <Reporter key="newer" status="saving" />
        <Status />
      </AutosaveStatusProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent('"status":"saving"');

    rerender(
      <AutosaveStatusProvider>
        <Reporter key="newer" status="saving" />
        <Status />
      </AutosaveStatusProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent('"status":"saving"');
    expect(screen.getByRole("status")).toHaveTextContent('"hasUnsavedChanges":true');
  });
});
