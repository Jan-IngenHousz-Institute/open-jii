/**
 * Shared test utilities for the web application.
 *
 * Provides a custom `render` function that wraps components with the
 * same providers used in production (QueryClient, tsr ReactQueryProvider),
 * eliminating the need to set up wrappers in every test file.
 *
 * Also re-exports everything from @testing-library/react and
 * @testing-library/user-event so test files only need one import.
 *
 * @example
 * ```tsx
 * import { render, screen, userEvent } from "@/test/test-utils";
 *
 * it("clicks a button", async () => {
 *   const user = userEvent.setup();
 *   render(<MyComponent />);
 *   await user.click(screen.getByRole("button", { name: /save/i }));
 *   expect(screen.getByText("Saved!")).toBeInTheDocument();
 * });
 * ```
 */
import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, renderHook as rtlRenderHook } from "@testing-library/react";
import type { RenderOptions, RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useRouter } from "next/navigation";
import React from "react";
import type { ReactElement } from "react";
import { FormProvider, useForm } from "react-hook-form";
import type { FieldValues, UseFormProps } from "react-hook-form";

// ── Provider wrapper ────────────────────────────────────────────

/**
 * Creates a fresh QueryClient for each test to prevent cross-test
 * state leakage. Retries are disabled so tests fail fast.
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryDelay: 0,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: React.ReactNode;
}

function AllProviders({ children }: WrapperProps) {
  const queryClient = createTestQueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// ── Custom render ───────────────────────────────────────────────

/**
 * Custom render that wraps the component in all required providers.
 *
 * Accepts the same options as RTL's `render`, plus an optional
 * `queryClient` if you need to pre-populate the cache.
 */
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
}

interface CustomRenderResult extends RenderResult {
  router: AppRouterInstance;
}

function render(ui: ReactElement, options?: CustomRenderOptions): CustomRenderResult {
  const { queryClient, ...renderOptions } = options ?? {};

  function Wrapper({ children }: WrapperProps) {
    const client = queryClient ?? createTestQueryClient();
    return (
      <QueryClientProvider client={client}>
        <tsr.ReactQueryProvider>{children}</tsr.ReactQueryProvider>
      </QueryClientProvider>
    );
  }

  const result = rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
  // eslint-disable-next-line react-hooks/rules-of-hooks -- useRouter is globally mocked in setup.ts
  const router = useRouter();
  return { ...result, router };
}

// ── Custom renderHook ───────────────────────────────────────────

/**
 * Custom renderHook that wraps hooks in all required providers.
 *
 * Supports the same `initialProps` option as RTL's `renderHook` so hooks
 * that accept arguments (e.g. useDebounce(value, delay)) can be tested
 * with rerender(newProps).
 */
function renderHook<TResult, TProps = undefined>(
  hook: TProps extends undefined ? () => TResult : (props: TProps) => TResult,
  options?: { queryClient?: QueryClient; initialProps?: TProps },
) {
  const { queryClient, initialProps } = options ?? {};

  function Wrapper({ children }: WrapperProps) {
    const client = queryClient ?? createTestQueryClient();
    return (
      <QueryClientProvider client={client}>
        <tsr.ReactQueryProvider>{children}</tsr.ReactQueryProvider>
      </QueryClientProvider>
    );
  }

  const hookResult = rtlRenderHook<TResult, TProps>(hook as (props: TProps) => TResult, {
    wrapper: Wrapper,
    ...(initialProps !== undefined && { initialProps }),
  });
  // eslint-disable-next-line react-hooks/rules-of-hooks -- useRouter is globally mocked in setup.ts
  const router = useRouter();
  return { ...hookResult, router } as {
    result: { current: TResult };
    rerender: (props?: TProps) => void;
    unmount: () => void;
    router: AppRouterInstance;
  };
}

// ── renderWithForm ──────────────────────────────────────────────

/**
 * Renders a component that depends on react-hook-form's `FormProvider` context.
 *
 * Instead of mocking form-aware UI primitives (`FormField`, `FormLabel`, etc.),
 * this helper creates a *real* `useForm` instance wrapped in a `FormProvider`,
 * following the react-hook-form testing guide:
 * https://react-hook-form.com/advanced-usage#TestingForm
 *
 * @param renderFn - receives the `UseFormReturn` instance, returns the JSX to render.
 * @param options  - optional `useFormProps` (defaultValues, resolver, …) plus
 *                   any standard RTL render options.
 *
 * @example
 * ```tsx
 * import { renderWithForm, screen } from "@/test/test-utils";
 *
 * renderWithForm<CreateUserProfileBody>(
 *   (form) => <ProfileCard form={form} />,
 *   { useFormProps: { defaultValues: { firstName: "", lastName: "" } } },
 * );
 * ```
 */
interface RenderWithFormOptions<T extends FieldValues> extends CustomRenderOptions {
  useFormProps?: UseFormProps<T>;
}

function renderWithForm<T extends FieldValues>(
  renderFn: (form: ReturnType<typeof useForm<T>>) => ReactElement,
  options?: RenderWithFormOptions<T>,
): RenderResult {
  const { useFormProps, ...renderOptions } = options ?? {};

  function FormWrapper() {
    const form = useForm<T>(useFormProps);
    return <FormProvider {...form}>{renderFn(form)}</FormProvider>;
  }

  return render(<FormWrapper />, renderOptions);
}

// ── Assertions ──────────────────────────────────────────────────

/**
 * Asserts that `value` is non-null and non-undefined, narrowing the type for
 * the rest of the scope. Prefer this over the `!` non-null assertion: when a
 * test selector breaks, the failure points at the assertion line with a
 * meaningful message instead of a downstream `Cannot read properties of
 * undefined`.
 *
 * @example
 * ```ts
 * const btn = svg.closest("button");
 * assertExists(btn, "delete button not found");
 * await user.click(btn); // narrowed to HTMLButtonElement
 * ```
 */
function assertExists<T>(value: T, message?: string): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message ?? `Expected value to exist, got ${String(value)}`);
  }
}

// ── Re-exports ──────────────────────────────────────────────────

// Re-export everything from RTL except render and renderHook (we provide custom versions)
export {
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
  act,
  cleanup,
  fireEvent,
  prettyDOM,
  logRoles,
  isInaccessible,
  configure,
  getDefaultNormalizer,
  queryHelpers,
  buildQueries,
  queries,
  queryAllByRole,
  queryByRole,
  getAllByRole,
  getByRole,
  findAllByRole,
  findByRole,
  queryAllByLabelText,
  queryByLabelText,
  getAllByLabelText,
  getByLabelText,
  findAllByLabelText,
  findByLabelText,
  queryAllByPlaceholderText,
  queryByPlaceholderText,
  getAllByPlaceholderText,
  getByPlaceholderText,
  findAllByPlaceholderText,
  findByPlaceholderText,
  queryAllByText,
  queryByText,
  getAllByText,
  getByText,
  findAllByText,
  findByText,
  queryAllByDisplayValue,
  queryByDisplayValue,
  getAllByDisplayValue,
  getByDisplayValue,
  findAllByDisplayValue,
  findByDisplayValue,
  queryAllByAltText,
  queryByAltText,
  getAllByAltText,
  getByAltText,
  findAllByAltText,
  findByAltText,
  queryAllByTitle,
  queryByTitle,
  getAllByTitle,
  getByTitle,
  findAllByTitle,
  findByTitle,
  queryAllByTestId,
  queryByTestId,
  getAllByTestId,
  getByTestId,
  findAllByTestId,
  findByTestId,
} from "@testing-library/react";

// Export our custom versions
export {
  render,
  renderHook,
  renderWithForm,
  userEvent,
  AllProviders,
  createTestQueryClient,
  assertExists,
};
