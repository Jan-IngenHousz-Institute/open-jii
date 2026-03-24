import React from "react";
import { create, act } from "react-test-renderer";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockReplace, mockIsOnline, mockUseSession } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockIsOnline: vi.fn().mockReturnValue(true),
  mockUseSession: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@tanstack/react-query", () => ({
  onlineManager: { isOnline: mockIsOnline },
}));

vi.mock("expo-router", () => {
  const Tabs = ({ children }: any) => React.createElement(React.Fragment, null, children);
  (Tabs as any).Screen = () => null;
  return {
    useRouter: () => ({ replace: mockReplace }),
    useSegments: () => [],
    Tabs,
  };
});

vi.mock("~/hooks/use-session", () => ({
  useSession: mockUseSession,
}));

vi.mock("~/hooks/use-theme", () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      primary: { dark: "#000" },
      dark: { inactive: "#666", surface: "#fff", border: "#eee", background: "#fff", onSurface: "#000" },
      light: { inactive: "#999", surface: "#fff", border: "#eee", background: "#fff", onSurface: "#000" },
    },
  }),
}));

vi.mock("lucide-react-native", () => ({
  FlaskConical: () => null,
  Settings: () => null,
  Workflow: () => null,
  Bluetooth: () => null,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock("~/components/recent-tab-icon", () => ({ RecentTabIcon: () => null }));
vi.mock("~/widgets/dev-indicator", () => ({ DevIndicator: () => null }));
vi.mock("~/widgets/device-connection-widget", () => ({ DeviceConnectionWidget: () => null }));

// ── Import after mocks ────────────────────────────────────────────────────────

import TabLayout from "../_layout";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderLayout() {
  let renderer: ReturnType<typeof create>;
  act(() => {
    renderer = create(React.createElement(TabLayout));
  });
  return {
    rerender: () => act(() => renderer.update(React.createElement(TabLayout))),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TabLayout auth guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline.mockReturnValue(true);
  });

  it("redirects to /callback when online, loaded, and no session", () => {
    mockUseSession.mockReturnValue({ session: undefined, isLoaded: true, error: undefined });

    renderLayout();

    expect(mockReplace).toHaveBeenCalledWith("/callback");
  });

  it("does not redirect when offline", () => {
    mockIsOnline.mockReturnValue(false);
    mockUseSession.mockReturnValue({ session: undefined, isLoaded: true, error: undefined });

    renderLayout();

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not redirect when session is present", () => {
    mockUseSession.mockReturnValue({ session: { data: {} }, isLoaded: true, error: undefined });

    renderLayout();

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not redirect when auth is still loading", () => {
    mockUseSession.mockReturnValue({ session: undefined, isLoaded: false, error: undefined });

    renderLayout();

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not redirect on a network error (error has no status)", () => {
    mockUseSession.mockReturnValue({ session: undefined, isLoaded: true, error: { message: "Network Error" } });

    renderLayout();

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects when there is a real auth error with a status code", () => {
    mockUseSession.mockReturnValue({ session: undefined, isLoaded: true, error: { status: 401, message: "Unauthorized" } });

    renderLayout();

    expect(mockReplace).toHaveBeenCalledWith("/callback");
  });

  it("redirects when coming back online after a network drop", () => {
    mockIsOnline.mockReturnValue(false);
    mockUseSession.mockReturnValue({ session: undefined, isLoaded: true, error: undefined });

    const { rerender } = renderLayout();
    expect(mockReplace).not.toHaveBeenCalled();

    mockIsOnline.mockReturnValue(true);
    rerender();

    expect(mockReplace).toHaveBeenCalledWith("/callback");
  });

  it("does not redirect when coming back online with a valid session", () => {
    mockIsOnline.mockReturnValue(false);
    mockUseSession.mockReturnValue({ session: { data: {} }, isLoaded: true, error: undefined });

    const { rerender } = renderLayout();

    mockIsOnline.mockReturnValue(true);
    rerender();

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects when session disappears after being present", () => {
    mockUseSession.mockReturnValue({ session: { data: {} }, isLoaded: true, error: undefined });

    const { rerender } = renderLayout();
    expect(mockReplace).not.toHaveBeenCalled();

    mockUseSession.mockReturnValue({ session: undefined, isLoaded: true, error: undefined });
    rerender();

    expect(mockReplace).toHaveBeenCalledWith("/callback");
  });

  it("does not redirect when network error clears but session is now present", () => {
    mockUseSession.mockReturnValue({ session: undefined, isLoaded: true, error: { message: "Network Error" } });

    const { rerender } = renderLayout();
    expect(mockReplace).not.toHaveBeenCalled();

    mockUseSession.mockReturnValue({ session: { data: {} }, isLoaded: true, error: undefined });
    rerender();

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects when network error clears but session is still absent", () => {
    mockUseSession.mockReturnValue({ session: undefined, isLoaded: true, error: { message: "Network Error" } });

    const { rerender } = renderLayout();
    expect(mockReplace).not.toHaveBeenCalled();

    mockUseSession.mockReturnValue({ session: undefined, isLoaded: true, error: undefined });
    rerender();

    expect(mockReplace).toHaveBeenCalledWith("/callback");
  });

  it("does not redirect while offline even if there is also a network error", () => {
    mockIsOnline.mockReturnValue(false);
    mockUseSession.mockReturnValue({ session: undefined, isLoaded: true, error: { message: "Network Error" } });

    renderLayout();

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
