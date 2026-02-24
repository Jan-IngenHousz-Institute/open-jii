# Testing Guide — `apps/web`

## Philosophy

Tests should **resemble how users interact with the application**. We follow the [Testing Library guiding principles](https://testing-library.com/docs/guiding-principles/):

> The more your tests resemble the way your software is used, the more confidence they can give you.

This means:

- **Query by role, label, or text** — not by `data-testid` or CSS class
- **Test behaviour, not implementation** — assert what the user sees, not which internal function was called
- **Render real components** — don't mock UI primitives from `@repo/ui/components`; only mock true system boundaries (network, storage, env)
- **Prefer fewer, meaningful tests** over many shallow "renders X" assertions

### What to mock

| Layer                              | Mock?        | How                                                |
| ---------------------------------- | ------------ | -------------------------------------------------- |
| Network (API calls)                | Yes          | MSW request handlers                               |
| `@repo/i18n` / `@repo/i18n/server` | Yes          | Global setup — returns translation keys            |
| `posthog-js/react` / `posthog-js`  | Yes          | Global setup — noop stubs                          |
| `next/navigation`                  | Yes          | Global setup — override per-test via `vi.mocked()` |
| `next/headers`                     | Yes          | Global setup — override per-test via `vi.mocked()` |
| `~/env`                            | Yes          | Global setup — deterministic test values           |
| `@repo/ui/components`              | **No**       | Render real components                             |
| `next/link`, `next/image`          | **No**       | Render real components (work in jsdom)             |
| `lucide-react` icons               | **No**       | Render real SVGs                                   |
| `@repo/cms` components             | Case-by-case | Mock when they make external CMS calls             |

### What makes a good test

```tsx
// ✅ Good — tests what the user experiences
it("shows experiment name and links to detail page", () => {
  render(<ExperimentCard experiment={createExperiment({ name: "Study A", id: "1" })} />);
  const link = screen.getByRole("link", { name: /Study A/i });
  expect(link).toHaveAttribute("href", "/platform/experiments/1");
});

// ❌ Bad — tests implementation details
it("calls useExperiment with correct id", () => {
  render(<ExperimentCard id="1" />);
  expect(useExperiment).toHaveBeenCalledWith("1");
});

// ❌ Bad — mocks the component under indirect test
vi.mock("@repo/ui/components", () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}));
```

---

## Infrastructure

All shared testing utilities live under `test/`:

```
test/
├── setup.ts          # Global setup (MSW lifecycle, polyfills, global mocks)
├── test-utils.tsx     # Custom render/renderHook with providers, re-exports RTL
├── factories.ts       # Test data factories (createExperiment, createSession, etc.)
└── msw/
    ├── handlers.ts    # Default MSW request handlers
    └── server.ts      # MSW server instance
```

### `test/setup.ts`

Loaded automatically via `setupFiles` in `vitest.config.ts`. Provides:

- **jest-dom matchers** — `toBeInTheDocument()`, `toHaveTextContent()`, etc.
- **React cleanup** — `afterEach(() => cleanup())`
- **MSW lifecycle** — `beforeAll(server.listen)`, `afterEach(server.resetHandlers)`, `afterAll(server.close)`
- **jsdom polyfills** — `window.matchMedia` for Radix UI components
- **Global mocks** — i18n, PostHog, next/navigation, next/headers, env

Because these are global, **test files should not re-declare** `vi.mock("@repo/i18n")` or `vi.mock("next/navigation")`. Instead, override specific return values per-test:

```tsx
import { redirect } from "next/navigation";
import { vi } from "vitest";

it("redirects unauthenticated users", async () => {
  vi.mocked(redirect).mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
  // ...
});
```

### `test/test-utils.tsx`

Custom `render()` and `renderHook()` that wrap components in `QueryClientProvider` (with retry disabled, gcTime 0). Eliminates boilerplate wrapper setup.

```tsx
import { render, screen, userEvent } from "@/test/test-utils";

it("submits on click", async () => {
  const user = userEvent.setup();
  render(<MyForm />);
  await user.click(screen.getByRole("button", { name: /submit/i }));
});
```

### `test/factories.ts`

Typed factory functions that return valid default objects. Use partial overrides:

```tsx
import { createExperiment, createSession } from "@/test/factories";

const experiment = createExperiment({ name: "My Study", status: "archived" });
const session = createSession({ user: { firstName: "Jane" } });
```

Available factories: `createExperiment`, `createTransferRequest`, `createExperimentAccess`, `createSession`, `resetFactories`.

### `test/msw/handlers.ts`

Default handlers for common API endpoints. Override per-test with `server.use()`:

```tsx
import { server } from "@/test/msw/server";
import { http, HttpResponse } from "msw";

it("shows error when API fails", async () => {
  server.use(
    http.get("http://localhost:3020/api/v1/experiments", () => {
      return new HttpResponse(null, { status: 500 });
    }),
  );
  // ...
});
```

---

## Patterns

### Testing hooks

Use `renderHook` from `test-utils` + MSW for API hooks:

```tsx
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { http, HttpResponse } from "msw";

it("fetches transfer requests", async () => {
  server.use(
    http.get("http://localhost:3020/api/v1/transfer-requests", () => {
      return HttpResponse.json([{ requestId: "1", status: "pending" }]);
    }),
  );

  const { result } = renderHook(() => useTransferRequests());
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(result.current.data).toHaveLength(1);
});
```

### Testing pages (server components)

Server components are `async` functions. Render them with `await`:

```tsx
it("renders the page", async () => {
  const Page = await import("./page").then((m) => m.default);
  const ui = await Page({ params: { locale: "en-US" } });
  render(ui);
  expect(screen.getByRole("heading")).toBeInTheDocument();
});
```

### Testing pages (with auth)

Use `vi.mocked()` to control auth state per-test:

```tsx
import { auth } from "~/app/actions/auth";

vi.mock("~/app/actions/auth");

it("redirects to login when unauthenticated", async () => {
  vi.mocked(auth).mockResolvedValue(null);
  const Page = (await import("./page")).default;
  const ui = await Page({ params: { locale: "en-US" } });
  render(ui);
  expect(redirect).toHaveBeenCalledWith("/en-US/login");
});
```

### Testing layouts

Same pattern as pages — layouts are functions that accept `{ children, params }`:

```tsx
it("renders children when authenticated", async () => {
  vi.mocked(auth).mockResolvedValue(createSession());
  const Layout = (await import("./layout")).default;
  const ui = await Layout({
    children: <div>Test Content</div>,
    params: Promise.resolve({ locale: "en-US" }),
  });
  render(ui);
  expect(screen.getByText("Test Content")).toBeInTheDocument();
});
```

### Overriding global mocks per-test

```tsx
import { usePathname } from "next/navigation";

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue("/en-US/about");
});
```

---

## Running tests

```bash
# Run all tests
pnpm test

# Run specific test file
npx vitest run "my-component.test"

# Run with verbose output
npx vitest run --reporter=verbose

# Run in watch mode
npx vitest

# Run with coverage
npx vitest run --coverage
```

---

## Coverage targets

- **North star:** 100% line/statement coverage for source files that have tests
- **Exception:** Dead/unreachable code paths that don't affect user behaviour can be left uncovered
- **New code:** Every new component, hook, or page should ship with tests

---

## Migration from old patterns

When refactoring existing tests, follow this checklist:

- [ ] Remove local `vi.mock("@repo/i18n")` — handled by global setup
- [ ] Remove local `vi.mock("next/navigation")` — handled by global setup
- [ ] Remove local `vi.mock("posthog-js/react")` — handled by global setup
- [ ] Remove local `vi.mock("~/env")` — handled by global setup
- [ ] Remove mocks for `@repo/ui/components` — render real components
- [ ] Remove mocks for `next/link` — renders fine in jsdom
- [ ] Remove mocks for `lucide-react` — renders fine in jsdom
- [ ] Replace `@testing-library/react` imports with `@/test/test-utils`
- [ ] Replace `fireEvent` with `userEvent.setup()` + `user.click()`
- [ ] Replace inline test data with factories from `@/test/factories`
- [ ] Replace `container.querySelector` with `screen.getByRole` / `screen.getByText`
- [ ] Remove "renders without crashing" tests — they add no value
- [ ] Merge redundant "renders X" tests into meaningful behaviour tests
