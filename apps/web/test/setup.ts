/**
 * Global test setup for the web application.
 *
 * This file is loaded by Vitest before every test file via `setupFiles`
 * in vitest.config.ts. It handles:
 *
 * 1. jest-dom matchers (toBeInTheDocument, toHaveTextContent, etc.)
 * 2. React cleanup after each test
 * 3. MSW server lifecycle (start → reset between tests → close)
 * 4. Global mocks that virtually every test needs (i18n, env, etc.)
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { server } from "./msw/server";

// ── jsdom polyfills ─────────────────────────────────────────────

// window.matchMedia is not implemented in jsdom but is used by
// Radix UI / shadcn sidebar components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ── MSW lifecycle ───────────────────────────────────────────────

beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
});

afterAll(() => {
  server.close();
});

// ── Global mocks ────────────────────────────────────────────────

// i18n — return translation keys so tests can assert on them
vi.mock("@repo/i18n", () => ({
  useTranslation: (_ns?: string) => ({
    t: (key: string) => key,
    i18n: { language: "en-US", changeLanguage: vi.fn() },
  }),
  defaultLocale: "en-US",
  locales: ["en-US"],
  namespaces: ["common", "questionCard", "registration", "settings", "experiments"],
  createInstance: vi.fn(() => ({
    use: vi.fn().mockReturnThis(),
    init: vi.fn().mockResolvedValue(undefined),
    t: (key: string) => key,
  })),
  initTranslations: vi.fn().mockResolvedValue({
    i18n: { t: (key: string) => key },
    resources: {},
  }),
}));

const initTranslationsMock = vi.fn().mockResolvedValue({
  t: (key: string) => key,
  i18n: { t: (key: string) => key },
  resources: {},
});

vi.mock("@repo/i18n/server", () => ({
  default: initTranslationsMock,
  initTranslations: initTranslationsMock,
}));

// PostHog — noop in tests
vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  }),
  useFeatureFlagEnabled: vi.fn().mockReturnValue(false),
  PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    __loaded: false,
  },
}));

// next/navigation — safe defaults; override per-test with vi.mocked()
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/platform/experiments",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale: "en-US" }),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// next/headers — safe defaults for server component tests
vi.mock("next/headers", () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: vi.fn().mockReturnValue("/platform/experiments"),
    }),
  ),
  cookies: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    }),
  ),
  draftMode: vi.fn(() => Promise.resolve({ isEnabled: false })),
}));

// next/link — render as simple anchor in tests
vi.mock("next/link", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return {
    __esModule: true,
    default: React.forwardRef(function MockLink(
      { children, href, ...rest }: Record<string, unknown>,
      ref: unknown,
    ) {
      return React.createElement("a", { href, ref, ...rest }, children);
    }),
  };
});

// next/image — render as plain img in tests
vi.mock("next/image", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return {
    __esModule: true,
    default: function MockImage(props: Record<string, unknown>) {
      return React.createElement("img", props);
    },
  };
});

// env — deterministic test values
vi.mock("~/env", () => ({
  env: {
    NODE_ENV: "test",
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
    NEXT_PUBLIC_API_URL: "http://localhost:3020",
    NEXT_PUBLIC_DOCS_URL: "http://localhost:3010",
    NEXT_PUBLIC_ENABLE_DEVTOOLS: "false",
    NEXT_PUBLIC_POSTHOG_KEY: "test-posthog-key",
    NEXT_PUBLIC_POSTHOG_HOST: "https://test.posthog.com",
    NEXT_PUBLIC_POSTHOG_UI_HOST: "https://test.ui.posthog.com",
  },
}));
