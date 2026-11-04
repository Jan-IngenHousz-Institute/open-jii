import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { vi } from "vitest";
import { TranslationsProvider } from "~/providers/translations-provider";

import { defaultLocale } from "@repo/i18n/config";
import { loadNamespaceBundles } from "@repo/i18n/server";
import type { StatusDocument } from "@repo/monitoring/status-document";
import { ThemeProvider } from "@repo/ui/components/theme";

/** Two minutes after the fixtures were generated, so none of them is stale. */
export const NOW = Date.parse("2026-11-03T12:02:00.000Z");

const resources = await loadNamespaceBundles(defaultLocale, ["status"]);

// A fresh client per render keeps one test's document out of the next. Without garbage collection
// no timer outlives a test that counts them.
export function QueryWrapper({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function renderWithProviders(ui: ReactNode) {
  return render(
    <QueryWrapper>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <TranslationsProvider locale={defaultLocale} namespaces={["status"]} resources={resources}>
          {ui}
        </TranslationsProvider>
      </ThemeProvider>
    </QueryWrapper>,
  );
}

/** A body the contract may not describe, for documents from a newer publisher. */
interface RawBody {
  raw: unknown;
}

type Outcome = StatusDocument | RawBody | "pending" | "fails" | "http-error" | "garbage";

function bodyOf(outcome: StatusDocument | RawBody | "garbage") {
  if (outcome === "garbage") {
    return { version: 99 };
  }

  return "raw" in outcome ? outcome.raw : outcome;
}

function respond(outcome: Outcome, serverHeaders: Headers, signal: AbortSignal | undefined) {
  if (outcome === "pending") {
    return new Promise<never>((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new Error("aborted")));
    });
  }
  if (outcome === "fails") {
    return Promise.reject(new Error("offline"));
  }
  if (outcome === "http-error") {
    return Promise.resolve({ ok: false, status: 503, headers: new Headers() });
  }

  const body = bodyOf(outcome);

  return Promise.resolve({
    ok: true,
    status: 200,
    headers: serverHeaders,
    json: () => Promise.resolve(body),
  });
}

function serverHeadersOf(date: string | undefined, ageSeconds: number | undefined) {
  const headers = new Headers();
  if (date !== undefined) {
    headers.set("Date", date);
  }
  if (ageSeconds !== undefined) {
    headers.set("Age", String(ageSeconds));
  }

  return headers;
}

/** `serverDate` is the response's `Date` header, as an HTTP date; without it the response has none. */
export function stubStatusFetch(initial: Outcome, serverDate?: string) {
  let outcome = initial;
  let date = serverDate;
  let age: number | undefined;
  const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
    respond(outcome, serverHeadersOf(date, age), init?.signal ?? undefined),
  );
  vi.stubGlobal("fetch", fetchMock);

  return {
    fetchMock,
    respondWith(next: Outcome) {
      outcome = next;
    },
    setServerDate(next: string | undefined) {
      date = next;
    },
    setServerAge(seconds: number) {
      age = seconds;
    },
  };
}

export function stubReducedMotion(isReduced: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: isReduced && query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}
