import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { server } from "./msw/server";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.clearAllMocks();
});
afterAll(() => server.close());

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
  const posthogInstance = {
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  };
  return {
    usePostHog: vi.fn(() => posthogInstance),
    useFeatureFlagEnabled: vi.fn().mockReturnValue(false),
    PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
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
