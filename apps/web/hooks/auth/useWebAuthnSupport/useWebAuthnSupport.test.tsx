import { renderHook, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWebAuthnSupport } from "./useWebAuthnSupport";

describe("useWebAuthnSupport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports support when PublicKeyCredential is available", async () => {
    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredential {});

    const { result } = renderHook(() => useWebAuthnSupport());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("stays false when WebAuthn is unavailable", () => {
    vi.stubGlobal("PublicKeyCredential", undefined);

    const { result } = renderHook(() => useWebAuthnSupport());

    expect(result.current).toBe(false);
  });
});
