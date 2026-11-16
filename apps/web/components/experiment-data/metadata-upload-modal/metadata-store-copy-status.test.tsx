import { fireEvent, render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { MetadataStoreCopy } from "@repo/api/domains/experiment/metadata/experiment-metadata.schema";

import { MetadataStoreCopyStatus } from "./metadata-store-copy-status";

describe("MetadataStoreCopyStatus", () => {
  it("offers a retry for a sheet the store could not take, and runs it", () => {
    const onRetry = vi.fn();
    render(<MetadataStoreCopyStatus storeCopy="failed" isRetrying={false} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button"));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("holds the retry back while one runs", () => {
    render(<MetadataStoreCopyStatus storeCopy="failed" isRetrying onRetry={vi.fn()} />);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("says a pending sheet is being prepared, without a retry", () => {
    const { container } = render(
      <MetadataStoreCopyStatus storeCopy="pending" isRetrying={false} onRetry={vi.fn()} />,
    );

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says nothing of a sheet the store holds, or where there is no store", () => {
    const quiet: (MetadataStoreCopy | null)[] = ["loaded", null];
    for (const storeCopy of quiet) {
      const { container, unmount } = render(
        <MetadataStoreCopyStatus storeCopy={storeCopy} isRetrying={false} onRetry={vi.fn()} />,
      );
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
});
