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
  // `isolate: false` shares the module cache across files in a worker.
  // Flushing it between files stops one file's `vi.mock` from poisoning
  // the next. See apps/web/TESTING.md for the full rationale.
  vi.resetModules();
});

// jsdom is missing these; Radix / cmdk / charts all touch them.
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
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
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

// Hoisted so `next/navigation`'s factory and the `beforeEach` below
// share the same reference.
const { mockRouter } = vi.hoisted(() => ({
  mockRouter: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  },
}));

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

vi.mock("@repo/i18n/server", () => {
  const initTranslations = vi.fn().mockResolvedValue({
    t: (key: string) => key,
    i18n: { t: (key: string) => key },
    resources: {},
  });
  return { default: initTranslations, initTranslations };
});

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => mockRouter),
  usePathname: vi.fn(() => "/platform/experiments"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({ locale: "en-US" })),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// `clearAllMocks` leaves per-test `mockReturnValue(...)` in place, so
// re-apply defaults here. The try/catch handles files that override
// `next/navigation` with a partial mock — vitest's mock proxy throws
// on access to exports the factory didn't return.
beforeEach(async () => {
  try {
    const nav = await import("next/navigation");
    vi.mocked(nav.useRouter).mockReturnValue(mockRouter as never);
    vi.mocked(nav.usePathname).mockReturnValue("/platform/experiments");
    vi.mocked(nav.useSearchParams).mockReturnValue(new URLSearchParams() as never);
    vi.mocked(nav.useParams).mockReturnValue({ locale: "en-US" });
  } catch {
    // Partial override of next/navigation; leave it alone.
  }
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

vi.mock("~/app/actions/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  providerMap: [],
  handleRegister: vi.fn(),
}));

vi.mock("~/app/actions/revalidate", () => ({
  revalidateAuth: vi.fn(),
}));

vi.mock("@repo/auth/client", () => ({
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
  useSession: vi.fn(() => ({ data: null, isPending: false })),
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

vi.mock("posthog-js/react", () => {
  const posthog = {
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  };
  return {
    usePostHog: vi.fn(() => posthog),
    useFeatureFlagEnabled: vi.fn().mockReturnValue(false),
    PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

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

vi.mock("@/hooks/useLocale", () => ({
  useLocale: vi.fn(() => "en-US"),
}));

// Spy on React.use so tests can override via vi.mocked(use).mockReturnValue(...)
vi.mock("react", async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, use: vi.fn(actual.use) };
});
