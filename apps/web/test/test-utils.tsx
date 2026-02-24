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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, type RenderOptions, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { type ReactElement } from "react";

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

function render(ui: ReactElement, options?: CustomRenderOptions): RenderResult {
  const { queryClient, ...renderOptions } = options ?? {};

  function Wrapper({ children }: WrapperProps) {
    const client = queryClient ?? createTestQueryClient();
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

// ── Custom renderHook ───────────────────────────────────────────

/**
 * Custom renderHook that wraps hooks in all required providers.
 */
function renderHook<TResult>(hook: () => TResult, options?: { queryClient?: QueryClient }) {
  const { renderHook: rtlRenderHook } = require("@testing-library/react");
  const { queryClient } = options ?? {};

  function Wrapper({ children }: WrapperProps) {
    const client = queryClient ?? createTestQueryClient();
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return rtlRenderHook(hook, { wrapper: Wrapper }) as {
    result: { current: TResult };
    rerender: () => void;
    unmount: () => void;
  };
}

// ── Re-exports ──────────────────────────────────────────────────

// Re-export everything from RTL so tests only import from test-utils
export * from "@testing-library/react";

// Override RTL's render/renderHook with our custom versions
export { render, renderHook, userEvent, AllProviders, createTestQueryClient };
