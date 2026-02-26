# Testing — `apps/web`

Test behaviour, not implementation. Query by role/text, render real components, mock only system boundaries (network, auth, env).

## File structure

```
.env.test            # Test env vars (auto-loaded by Vitest)
test/
├── setup.ts         # Global mocks + MSW lifecycle (loaded via vitest setupFiles)
├── test-utils.tsx   # render() / renderHook() wrapped in QueryClientProvider
├── factories.ts     # createExperiment(), createSession(), etc.
└── msw/
    ├── handlers.ts  # Empty — each test mounts its own endpoints
    ├── mount.ts     # server.mount() implementation
    └── server.ts    # MSW server + mount()
```

## Global mocks (`test/setup.ts`)

These are already mocked globally. **Do not re-declare them in test files.**

| Module / Global                   | Default                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `global.ResizeObserver`           | Noop stub (not implemented in jsdom, required by Radix UI / shadcn)                                                                |
| `window.matchMedia`               | Noop stub (not implemented in jsdom, required by Radix UI / shadcn)                                                                |
| `@repo/i18n`, `@repo/i18n/server` | `t(key)` returns the key                                                                                                           |
| `next/navigation`                 | `useRouter()` returns spied router, `usePathname()` returns `"/platform/experiments"`, `useParams()` returns `{ locale: "en-US" }` |
| `next/headers`                    | `headers()`, `cookies()`, `draftMode()` stubs                                                                                      |
| `~/app/actions/auth`              | `auth()` resolves to `null` (unauthenticated)                                                                                      |
| `~/app/actions/revalidate`        | `revalidateAuth()` noop                                                                                                            |
| `@repo/auth/client`               | `authClient` methods resolve `{ data: null, error: null }`, `useSession()` returns `{ data: null, isPending: false }`              |
| `@repo/ui/hooks`                  | `toast()` noop spy                                                                                                                 |
| `@/hooks/useLocale`               | Returns `"en-US"`                                                                                                                  |
| `posthog-js`                      | Noop stubs (`init`, `capture`, `identify`, `reset`, `opt_in_capturing`, `opt_out_capturing`)                                       |
| `posthog-js/react`                | `usePostHog()` returns a **stable singleton** with spied methods — safe to assert on directly                                      |
| `React.use`                       | Spy wrapping real implementation                                                                                                   |

Environment variables come from `.env.test` (Vitest auto-loads it). The zod schema in `env.ts` provides defaults for most values; `.env.test` only sets non-default ones like PostHog keys. To override env in a single test file, use `vi.mock("~/env")` — per-file mocks take precedence.

**Do not mock** `@repo/ui/components`, `next/link`, `next/image`, `lucide-react` — they work fine in jsdom.

## Per-test overrides

Override return values with `vi.mocked()`. No need for another `vi.mock()` call.

```tsx
// Auth
vi.mocked(auth).mockResolvedValue(createSession());

// Router
const { router } = render(<MyComponent />);
expect(router.push).toHaveBeenCalledWith("/somewhere");

// React.use (for client components with Promise params)
vi.mocked(use).mockReturnValue({ id: "exp-1", locale: "en-US" });

// authClient
vi.mocked(authClient.signIn.emailOtp).mockResolvedValue({
  data: { user: { registered: true } },
  error: null,
});

// Testing a globally mocked module's real implementation
vi.unmock("~/app/actions/auth");
```

## MSW + `server.mount()` — preferred for API mocking

**Prefer `server.mount()` over `vi.mock()` on hooks that call the API.** This lets hooks, query state, and data flow run for real — the test only controls the network boundary.

```diff
# ❌ Avoid: mocking the hook
- vi.mock("@/hooks/experiment/useExperimentUpdate/useExperimentUpdate", () => ({
-   useExperimentUpdate: () => ({ mutateAsync: vi.fn(), isPending: false }),
- }));

# ✅ Prefer: mock the network via MSW
+ const spy = server.mount(contract.experiments.updateExperiment, {
+   body: createExperiment({ id: "exp-1" }),
+ });
```

Every test mounts exactly the endpoints it needs:

```tsx
import { server } from "@/test/msw/server";

import { contract } from "@repo/api";

// Return data
server.mount(contract.experiments.listExperiments, {
  body: [createExperiment(), createExperiment()],
});

// Return error
server.mount(contract.experiments.getExperiment, { status: 404 });

// Capture request params/body
const spy = server.mount(contract.macros.createMacro, {
  body: createMacro({ id: "new-1" }),
});
// ... trigger action ...
expect(spy.body).toMatchObject({ name: "Test" });
expect(spy.params.id).toBe("new-1");
```

## Factories (`test/factories.ts`)

Return valid defaults. Override only what the test cares about.

```tsx
createExperiment({ name: "Study A", status: "archived" });
createSession({ user: { firstName: "Jane" } });
createVisualization({ experimentId: "exp-1" });
```

Available: `createExperiment`, `createTransferRequest`, `createExperimentAccess`, `createSession`, `createMacro`, `createProtocol`, `createUserProfile`, `createVisualization`, `createExperimentTable`, `createExperimentDataTable`, `createPlace`, `createLocation`, `createFlow`, `createFlowNode`.

**Extend `test/factories.ts`** whenever a test needs a new entity type or shape. Add a new factory function following the existing pattern (sequential ID, sensible defaults, `Partial<T>` overrides). This keeps hand-crafted test data and `as any` casts out of individual test files.

## `render()` and `renderHook()`

Both from `@/test/test-utils`. They wrap in `QueryClientProvider` + `tsr.ReactQueryProvider` (retry disabled, gcTime 0) and return a `router` alongside the RTL result.

```tsx
import { render, screen, userEvent, waitFor, renderHook } from "@/test/test-utils";

const user = userEvent.setup();
const { router } = render(<MyComponent />);
await user.click(screen.getByRole("button", { name: /save/i }));
```

## Common patterns

**Server component (page/layout):**

```tsx
it("renders the page", async () => {
  const Page = (await import("./page")).default;
  render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
  expect(screen.getByRole("heading")).toBeInTheDocument();
});
```

**Authenticated page:**

```tsx
it("redirects when unauthenticated", async () => {
  // auth returns null by default
  const Page = (await import("./page")).default;
  render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
  expect(redirect).toHaveBeenCalledWith("/en-US/login");
});

it("shows content when authenticated", async () => {
  vi.mocked(auth).mockResolvedValue(createSession());
  const Page = (await import("./page")).default;
  render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
  expect(screen.getByText("settings.title")).toBeInTheDocument();
});
```

**Hook with API call:**

```tsx
it("fetches locations", async () => {
  const locations = [createLocation(), createLocation()];
  server.mount(contract.experiments.getExperimentLocations, { body: locations });

  const { result } = renderHook(() => useExperimentLocations("exp-1"));
  await waitFor(() => expect(result.current.data?.body).toHaveLength(2));
});
```

## Running tests

```bash
pnpm test                                        # all tests
pnpm test -- --run "my-component.test"            # single file
pnpm test -- --coverage                           # with coverage
pnpm test -- --watch                              # watch mode
```
