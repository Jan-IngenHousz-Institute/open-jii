import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";

import { server } from "./msw/server";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.clearAllMocks();
});
afterAll(() => {
  server.close();
  // With `isolate: false`, module cache is shared across test files in a
  // worker, so a `vi.mock(...)` from one file can leave a cached mocked
  // module around that poisons unrelated files. Resetting modules here
  // (setupFiles `afterAll` runs per test file) forces the next file to
  // re-import fresh, with only *its own* mock registrations in effect.
  vi.resetModules();
});

// ResizeObserver is not implemented in jsdom but used by Radix UI / shadcn
global.ResizeObserver = class ResizeObserver {
  observe() {
    // noop
  }
  unobserve() {
    // noop
  }
  disconnect() {
    // noop
  }
};

// scrollIntoView is not implemented in jsdom but used by cmdk, charts, etc.
Element.prototype.scrollIntoView = vi.fn();

// Pointer-capture methods are not implemented in jsdom but used by Radix UI
// Select / Popover / DropdownMenu pointer-event handling.
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

// window.matchMedia is not implemented in jsdom but used by Radix UI / shadcn
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

// ── Singleton mock objects ──────────────────────────────────────
//
// With `isolate: false`, setup.ts re-runs for each test file but modules are
// cached across files. A plain `vi.hoisted` block would create a fresh
// mockRouter (and other mock objects) per file, while production modules
// still hold the binding from the *first* file's factory run. That mismatch
// makes tests fail non-deterministically with "vi.fn() called 0 times".
//
// Caching on `globalThis` inside `vi.hoisted` makes these objects true
// singletons across all files in the worker, so every `useRouter()` call —
// from test code or production code — returns the same mockRouter.
const { mocks } = vi.hoisted(() => {
  const g = globalThis as unknown as {
    __jiiWebTestMocks?: {
      mockRouter: {
        push: ReturnType<typeof vi.fn>;
        replace: ReturnType<typeof vi.fn>;
        back: ReturnType<typeof vi.fn>;
        forward: ReturnType<typeof vi.fn>;
        refresh: ReturnType<typeof vi.fn>;
        prefetch: ReturnType<typeof vi.fn>;
      };
      authClient: {
        signOut: ReturnType<typeof vi.fn>;
        emailOtp: {
          sendVerificationOtp: ReturnType<typeof vi.fn>;
        };
        signIn: {
          emailOtp: ReturnType<typeof vi.fn>;
          social: ReturnType<typeof vi.fn>;
          oauth2: ReturnType<typeof vi.fn>;
        };
        updateUser: ReturnType<typeof vi.fn>;
        getSession: ReturnType<typeof vi.fn>;
      };
      posthog: {
        init: ReturnType<typeof vi.fn>;
        capture: ReturnType<typeof vi.fn>;
        identify: ReturnType<typeof vi.fn>;
        reset: ReturnType<typeof vi.fn>;
        opt_in_capturing: ReturnType<typeof vi.fn>;
        opt_out_capturing: ReturnType<typeof vi.fn>;
        __loaded: boolean;
      };
      posthogReact: {
        opt_in_capturing: ReturnType<typeof vi.fn>;
        opt_out_capturing: ReturnType<typeof vi.fn>;
        reset: ReturnType<typeof vi.fn>;
        capture: ReturnType<typeof vi.fn>;
      };
    };
  };
  g.__jiiWebTestMocks ??= {
    mockRouter: {
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    },
    authClient: {
      signOut: vi.fn().mockResolvedValue({ data: null, error: null }),
      emailOtp: {
        sendVerificationOtp: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
      signIn: {
        emailOtp: vi.fn().mockResolvedValue({ data: null, error: null }),
        social: vi.fn().mockResolvedValue({ data: null, error: null }),
        oauth2: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
      updateUser: vi.fn().mockResolvedValue({ data: null, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    posthog: {
      init: vi.fn(),
      capture: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
      __loaded: false,
    },
    posthogReact: {
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
      reset: vi.fn(),
      capture: vi.fn(),
    },
  };
  return { mocks: g.__jiiWebTestMocks };
});

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

vi.mock("@repo/i18n/client", () => ({
  useTranslation: (_ns?: string) => ({
    t: (key: string) => key,
    i18n: { language: "en-US", changeLanguage: vi.fn() },
  }),
  Trans: ({ i18nKey, children }: { i18nKey?: string; children?: unknown }) =>
    children ?? i18nKey ?? null,
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

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => mocks.mockRouter as never),
  usePathname: vi.fn(() => "/platform/experiments"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({ locale: "en-US" })),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Re-apply default mock implementations before each test to prevent
// cross-test leakage with `isolate: false`. Each property access is
// guarded so that test files which override the nav mock entirely
// (e.g. `vi.mock("next/navigation", () => ({ redirect: ... }))`) don't
// crash this hook — vitest's mock proxy throws on access to exports
// that weren't returned from the factory, so we swallow that.
beforeEach(async () => {
  const nav = (await import("next/navigation")) as unknown as Record<string, unknown>;
  const safeMock = (key: string): ReturnType<typeof vi.fn> | undefined => {
    try {
      const value = nav[key];
      return typeof value === "function" && vi.isMockFunction(value)
        ? (value as ReturnType<typeof vi.fn>)
        : undefined;
    } catch {
      return undefined;
    }
  };
  safeMock("useRouter")?.mockReturnValue(mocks.mockRouter as never);
  safeMock("usePathname")?.mockReturnValue("/platform/experiments" as never);
  safeMock("useSearchParams")?.mockReturnValue(new URLSearchParams() as never);
  safeMock("useParams")?.mockReturnValue({ locale: "en-US" } as never);
});

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

// Default: unauthenticated. Override per test: vi.mocked(auth).mockResolvedValue(createSession())
vi.mock("~/app/actions/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  providerMap: [],
  handleRegister: vi.fn(),
}));

vi.mock("~/app/actions/revalidate", () => ({
  revalidateAuth: vi.fn(),
}));

vi.mock("@repo/auth/client", () => ({
  authClient: mocks.authClient,
  useSession: vi.fn(() => ({ data: null, isPending: false })),
}));

vi.mock("posthog-js", () => ({
  default: mocks.posthog,
}));

vi.mock("posthog-js/react", () => ({
  usePostHog: vi.fn(() => mocks.posthogReact),
  useFeatureFlagEnabled: vi.fn().mockReturnValue(false),
  PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@repo/ui/hooks/use-toast", () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn(), toasts: [], dismiss: vi.fn() }),
}));

vi.mock("~/lib/contentful", () => ({
  getContentfulClients: vi.fn().mockResolvedValue({
    client: {},
    previewClient: {},
  }),
}));

// vi.fn() so tests can override: vi.mocked(useLocale).mockReturnValue("de-DE")
vi.mock("@/hooks/useLocale", () => ({
  useLocale: vi.fn(() => "en-US"),
}));

// Wraps React.use in a spy so tests can override:
//   vi.mocked(use).mockReturnValue({ id: "exp-123", locale: "en-US" })
vi.mock("react", async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, use: vi.fn(actual.use) };
});
