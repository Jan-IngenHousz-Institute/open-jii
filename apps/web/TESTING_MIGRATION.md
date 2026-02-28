# Test Migration Guide

246 test files total. ~89 already use the new patterns. This doc covers what to change in the rest.

## 1. Replace `@testing-library/react` imports (~144 files)

```diff
- import { render, screen, waitFor } from "@testing-library/react";
- import userEvent from "@testing-library/user-event";
+ import { render, screen, waitFor, userEvent } from "@/test/test-utils";
```

`@/test/test-utils` wraps everything in `QueryClientProvider` + `tsr.ReactQueryProvider` and returns a `router` alongside the RTL result. No more manual wrapper setup.

```tsx
const { router } = render(<MyComponent />);
// eslint-disable-next-line @typescript-eslint/unbound-method
expect(router.push).toHaveBeenCalledWith("/somewhere");
```

Same for hooks:

```tsx
const { result, router } = renderHook(() => useMyHook());
```

## 2. Replace `fireEvent` with `userEvent` (~40 files)

```diff
- fireEvent.click(button);
+ const user = userEvent.setup();
+ await user.click(button);

- fireEvent.change(input, { target: { value: "test" } });
+ await user.clear(input);
+ await user.type(input, "test");
```

`userEvent` fires real browser events (pointer, keyboard, focus) rather than synthetic ones. Tests must be `async`.

## 3. Replace `container.querySelector` with screen queries (~27 files)

```diff
- const { container } = render(<MyComponent />);
- const badge = container.querySelector(".badge");
+ render(<MyComponent />);
+ const badge = screen.getByRole("status");
```

Prefer `getByRole` > `getByText` > `getByTestId`. Only use `data-testid` as a last resort.

## 4. Replace inline mock data with factories (~35 files)

```diff
- const mockExperiment = { id: "1", name: "Test", status: "active", ... };
+ const experiment = createExperiment({ name: "Test" });
```

Factories return complete, valid objects. Override only the fields the test cares about. Available in `@/test/factories`:

`createExperiment`, `createTransferRequest`, `createExperimentAccess`, `createSession`, `createMacro`, `createProtocol`, `createUserProfile`, `createVisualization`, `createExperimentTable`, `createExperimentDataTable`, `createPlace`, `createLocation`

## 5. Use `server.mount()` for API mocking

Tests that need API responses should use `server.mount()` with the ts-rest contract instead of manual `fetch` mocks or `vi.mock()` on hooks.

```diff
- vi.mock("@/hooks/experiment/useExperiments", () => ({
-   useExperiments: () => ({ data: [{ id: "1" }], isLoading: false }),
- }));
+ server.mount(contract.experiments.listExperiments, {
+   body: [createExperiment({ id: "1" })],
+ });
```

This lets the real hook run and makes the test cover the actual data flow.

```tsx
// Capture request params
const spy = server.mount(contract.macros.createMacro, {
  body: createMacro({ id: "new-1" }),
});
// ... trigger submit ...
expect(spy.body).toMatchObject({ name: "Test" });
expect(spy.params.id).toBe("new-1");

// Error responses
server.mount(contract.experiments.getExperiment, { status: 404 });
```

## 6. Remove redundant per-file `vi.mock()` calls

These modules are mocked globally in `test/setup.ts`. Remove any per-file `vi.mock()` for them:

- `@repo/i18n`
- `@repo/i18n/server`
- `next/navigation`
- `next/headers`
- `posthog-js` / `posthog-js/react`
- `~/env`
- `@repo/ui/hooks`
- `@/hooks/useLocale`
- `~/app/actions/auth`
- `~/app/actions/revalidate`
- `@repo/auth/client`
- `react` (for `React.use`)

Override return values per-test with `vi.mocked()`:

```tsx
vi.mocked(auth).mockResolvedValue(createSession());
vi.mocked(usePathname).mockReturnValue("/en-US/about");
vi.mocked(use).mockReturnValue({ id: "exp-1" });
```

If testing the real implementation of a globally mocked module, use `vi.unmock()`:

```tsx
vi.unmock("~/app/actions/auth");
```

## 7. Don't mock UI primitives

`@repo/ui/components`, `next/link`, `next/image`, `lucide-react` all work in jsdom. Render them for real.

## File-by-file approach

For each test file:

1. Replace `@testing-library/react` import with `@/test/test-utils`
2. Replace `fireEvent` with `userEvent.setup()` + `await user.click/type/etc.`
3. Replace `container.querySelector` with `screen.getByRole` / `screen.getByText`
4. Replace hand-crafted mock objects with factory calls
5. Remove redundant `vi.mock()` calls for globally mocked modules
6. Replace hook mocks with `server.mount()` where the hook makes API calls
7. Run the file: `pnpm test -- --run "path/to/file.test"`
