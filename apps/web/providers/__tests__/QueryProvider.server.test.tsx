import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { QueryProvider } from "../QueryProvider";

vi.mock(import("@tanstack/react-query"), async (importOriginal) => ({
  ...(await importOriginal()),
  isServer: true,
}));

function clientOfOneRender(): QueryClient | undefined {
  let captured: QueryClient | undefined;
  function Capture() {
    captured = useQueryClient();
    return null;
  }
  renderToString(
    <QueryProvider>
      <Capture />
    </QueryProvider>,
  );
  return captured;
}

describe("QueryProvider on the server", () => {
  it("gives each render its own client, so one request's data never reaches another", () => {
    const first = clientOfOneRender();
    const second = clientOfOneRender();

    expect(first).toBeDefined();
    expect(first).not.toBe(second);
  });
});
