import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";

import { server } from "./msw/server";

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

// jsdom lacks canvas + SVGPathElement.getTotalLength; Plotly probes both.
if (typeof SVGPathElement !== "undefined") {
  Object.defineProperty(SVGPathElement.prototype, "getTotalLength", {
    configurable: true,
    value: vi.fn(() => 0),
  });
}
Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
  configurable: true,
  value: vi.fn(() => "data:,"),
});
Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
  configurable: true,
  value: vi.fn((cb: (blob: Blob | null) => void) => cb(new Blob())),
});
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: vi.fn(() => ({
    fillStyle: "",
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray() })),
    createImageData: vi.fn(() => ({ data: new Uint8ClampedArray() })),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    setTransform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  })),
});
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
  isKnownLocale: (locale: string) => ["en-US", "de-DE"].includes(locale),
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
  // Real next/navigation re-exports a RURP subclass; tests construct one via
  // `new nav.ReadonlyURLSearchParams(qs)` to feed mockReturnValue without casts.
  ReadonlyURLSearchParams: URLSearchParams,
}));

// clearAllMocks leaves per-test mockReturnValue(...) in place; re-apply
// defaults here. Files that partially re-mock next/navigation get caught
// because the proxy throws on access to exports the factory didn't return.
beforeEach(async () => {
  try {
    const nav = await import("next/navigation");
    vi.mocked(nav.useRouter).mockReturnValue(mockRouter);
    vi.mocked(nav.usePathname).mockReturnValue("/platform/experiments");
    vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams());
    vi.mocked(nav.useParams).mockReturnValue({ locale: "en-US" });
  } catch {
    // Partial override; leave it alone.
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
    useListOrganizations: vi.fn(() => ({ data: [], isPending: false })),
    useActiveOrganization: vi.fn(() => ({ data: null, isPending: false })),
    organization: {
      setActive: vi.fn().mockResolvedValue({ data: null, error: null }),
      getFullOrganization: vi
        .fn()
        .mockResolvedValue({ data: { members: [], invitations: [] }, error: null }),
      inviteMember: vi.fn().mockResolvedValue({ data: {}, error: null }),
      removeMember: vi.fn().mockResolvedValue({ data: {}, error: null }),
      updateMemberRole: vi.fn().mockResolvedValue({ data: {}, error: null }),
      cancelInvitation: vi.fn().mockResolvedValue({ data: {}, error: null }),
      acceptInvitation: vi.fn().mockResolvedValue({ data: {}, error: null }),
      createTeam: vi.fn().mockResolvedValue({ data: {}, error: null }),
      listTeamMembers: vi.fn().mockResolvedValue({ data: [], error: null }),
      addTeamMember: vi.fn().mockResolvedValue({ data: {}, error: null }),
      removeTeamMember: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
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
  useIsMobile: vi.fn(() => false),
  useIsTablet: vi.fn(() => false),
  useIsLgTablet: vi.fn(() => false),
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

// CodeMirror cannot run in jsdom (no getClientRects, etc.), so mock the wrapper.
vi.mock("~/components/shared/code-editor", async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    CodeEditor: (props: Record<string, unknown>) =>
      React.createElement(
        "div",
        {
          "data-testid": "code-editor",
          "data-language": props.language,
          "data-height": props.height,
        },
        React.createElement("textarea", {
          "data-testid": "code-editor-textarea",
          value: props.value,
          readOnly: props.readOnly,
          onChange: (e: { target: { value: string } }) =>
            (props.onChange as ((v: string) => void) | undefined)?.(e.target.value),
        }),
      ),
    createSyntaxLinter: vi.fn(),
  };
});
