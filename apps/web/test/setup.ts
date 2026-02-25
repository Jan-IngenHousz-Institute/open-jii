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
  vi.clearAllMocks();
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
// Uses stable refs so tests can spy on router methods:
//   import { useRouter } from "next/navigation";
//   expect(vi.mocked(useRouter)().push).toHaveBeenCalledWith("/foo");
vi.mock("next/navigation", () => {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
  return {
    useRouter: vi.fn(() => router),
    usePathname: vi.fn(() => "/platform/experiments"),
    useSearchParams: vi.fn(() => new URLSearchParams()),
    useParams: vi.fn(() => ({ locale: "en-US" })),
    redirect: vi.fn(),
    notFound: vi.fn(),
  };
});

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

// toast — UI side-effect, not HTTP; global mock avoids per-file boilerplate
vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

// useLocale — reads i18n.language (already mocked above); keep as a vi.fn()
// so tests can override: vi.mocked(useLocale).mockReturnValue("de-DE")
vi.mock("@/hooks/useLocale", () => ({
  useLocale: vi.fn(() => "en-US"),
}));

// React.use — spy wrapping the real implementation so tests that don't
// override it get normal React behaviour (context reads, promise resolution).
// Override per file in beforeEach:
//   import { use } from "react";
//   vi.mocked(use).mockReturnValue({ id: "exp-123", locale: "en-US" });
vi.mock("react", async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, use: vi.fn(actual.use) };
});

// auth server action — returns Session | null. Default: null (unauthenticated).
// Override per test: vi.mocked(auth).mockResolvedValue(createSession())
vi.mock("~/app/actions/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  providerMap: [],
  handleRegister: vi.fn(),
}));

// revalidateAuth — server action used by auth hooks' onSuccess callbacks
vi.mock("~/app/actions/revalidate", () => ({
  revalidateAuth: vi.fn(),
}));

// authClient — better-auth HTTP client; auth hooks (useSignOut etc.) call these.
// Mocked globally so hooks work without real HTTP requests.
vi.mock("@repo/auth/client", () => ({
  authClient: {
    signOut: vi.fn().mockResolvedValue({ data: null, error: null }),
    emailOtp: {
      sendVerificationOtp: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    signIn: {
      emailOtp: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    updateUser: vi.fn().mockResolvedValue({ data: null, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
  useSession: vi.fn(() => ({ data: null, isPending: false })),
}));
