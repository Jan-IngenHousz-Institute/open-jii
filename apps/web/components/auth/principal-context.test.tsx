import { createSession, createUseSessionResult } from "@/test/factories";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSession } from "@repo/auth/client";

import { PrincipalProvider, usePrincipal } from "./principal-context";

function ServerUser({ children }: { children: ReactNode }) {
  return <PrincipalProvider userId="user-1">{children}</PrincipalProvider>;
}

describe("usePrincipal", () => {
  afterEach(() => {
    vi.mocked(useSession).mockReturnValue(createUseSessionResult());
  });

  it("waits for the browser's session outside the platform", () => {
    vi.mocked(useSession).mockReturnValue(createUseSessionResult({ isPending: true }));

    const { result } = renderHook(() => usePrincipal());

    expect(result.current).toEqual({ userId: undefined, isPending: true });
  });

  it("uses the server's user while the browser's session loads", () => {
    vi.mocked(useSession).mockReturnValue(createUseSessionResult({ isPending: true }));

    const { result } = renderHook(() => usePrincipal(), { wrapper: ServerUser });

    expect(result.current).toEqual({ userId: "user-1", isPending: false });
  });

  it("lets the browser's session win once it has loaded", () => {
    vi.mocked(useSession).mockReturnValue(
      createUseSessionResult({ data: createSession({ user: { id: "user-2" } }) }),
    );

    const { result } = renderHook(() => usePrincipal(), { wrapper: ServerUser });

    expect(result.current).toEqual({ userId: "user-2", isPending: false });
  });
});
