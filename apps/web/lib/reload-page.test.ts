import { afterEach, expect, it, vi } from "vitest";

import { reloadPage } from "./reload-page";

afterEach(() => vi.unstubAllGlobals());
it("reloads the browser after identity-dependent query state has been cleared", () => {
  const reload = vi.fn();
  vi.stubGlobal("window", { location: { reload } });
  reloadPage();
  expect(reload).toHaveBeenCalledTimes(1);
});
