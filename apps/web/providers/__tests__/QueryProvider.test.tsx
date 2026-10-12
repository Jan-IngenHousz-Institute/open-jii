import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QueryProvider } from "../QueryProvider";

function captureClient(): QueryClient {
  let captured: QueryClient | undefined;
  function Capture() {
    captured = useQueryClient();
    return null;
  }
  render(
    <QueryProvider>
      <Capture />
    </QueryProvider>,
  );
  if (!captured) {
    throw new Error("no query client was provided");
  }
  return captured;
}

describe("QueryProvider in the browser", () => {
  it("keeps one client for the whole session", () => {
    expect(captureClient()).toBe(captureClient());
  });

  it("treats data as fresh for 30 seconds", () => {
    expect(captureClient().getDefaultOptions().queries?.staleTime).toBe(30_000);
  });
});
