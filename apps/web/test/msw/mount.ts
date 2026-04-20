/**
 * `server.mount()` — concise per-test endpoint override.
 *
 * A thin wrapper around `server.use(http[method](url, handler))` that:
 * - Derives the HTTP method & URL from a ts-rest contract endpoint
 * - Returns a {@link RequestSpy} for asserting on request details
 * - Picks sensible default status codes (200/201/204) per method
 *
 * No factory knowledge — tests provide the exact body they want.
 */
import { http, HttpResponse, delay as mswDelay } from "msw";
import type { SetupServer } from "msw/node";

export const API_URL = "http://localhost:3020";

// ── Types ───────────────────────────────────────────────────────

/** Minimal shape of a ts-rest contract endpoint with typed responses. */
export interface ContractEndpoint {
  method: string;
  path: string;
  responses: Record<number, unknown>;
}

/** Resolve a ts-rest response schema to its inferred output type. */
type InferBody<T> = T extends { _output: infer O } ? O : T extends null ? null : unknown;

/** Status codes defined in an endpoint's responses. */
type StatusOf<T extends ContractEndpoint> = Extract<keyof T["responses"], number>;

/** Union of all possible body types for an endpoint's responses. */
type AnyBody<T extends ContractEndpoint> = {
  [S in StatusOf<T>]: InferBody<T["responses"][S]>;
}[StatusOf<T>];

/** Type-safe mount function - infers status codes and body types from the contract. */
export type MountFn = <T extends ContractEndpoint>(
  endpoint: T,
  options?: {
    /** HTTP status - contract-defined codes + 500. */
    status?: StatusOf<T> | 500;
    /** JSON response body. */
    body?: AnyBody<T>;
    /** Artificial delay in ms before responding. */
    delay?: number;
  },
) => RequestSpy;

/** Individual request captured by the spy. */
export interface SpyCall {
  /** Parsed JSON body (POST/PATCH/PUT). */
  body: unknown;
  /** Path params (e.g. `{ id: "exp-1" }`). */
  params: Record<string, string | readonly string[]>;
  /** Parsed query parameters from the request URL. */
  query: Record<string, string>;
  /** Full request URL including query string. */
  url: string;
}

/** Captures request details. Populated when MSW handles the request. */
export interface RequestSpy {
  /** Whether the handler was invoked at least once. */
  called: boolean;
  /** All captured invocations, most recent last. */
  calls: SpyCall[];
  /** Shorthand: number of times the handler was invoked. */
  readonly callCount: number;
  // ── Last-call shortcuts (backwards-compatible) ──────────────
  /** Parsed JSON body of the *last* request. */
  body: unknown;
  /** Path params of the *last* request. */
  params: Record<string, string | readonly string[]>;
  /** Full URL of the *last* request. */
  url: string;
}

// ── Implementation ──────────────────────────────────────────────

type HttpMethod = "get" | "post" | "patch" | "put" | "delete";

function statusForMethod(method: HttpMethod): number {
  if (method === "post") return 201;
  if (method === "delete") return 204;
  return 200;
}

/**
 * Create a `mount` function bound to the given MSW server instance.
 * Called once in `server.ts`; tests use `server.mount(…)`.
 */
export function createMount(server: SetupServer): MountFn {
  function mount(
    endpoint: ContractEndpoint,
    options: { body?: unknown; status?: number; delay?: number } = {},
  ): RequestSpy {
    const method = endpoint.method.toLowerCase() as HttpMethod;
    const url = `${API_URL}${endpoint.path}`;

    const spy: RequestSpy = {
      called: false,
      calls: [],
      get callCount() {
        return this.calls.length;
      },
      body: null,
      params: {},
      url: "",
    };

    const handler = http[method](url, async ({ request, params }) => {
      // ── Parse query params ──────────────────────────────────
      const parsed = new URL(request.url);
      const query: Record<string, string> = {};
      parsed.searchParams.forEach((v, k) => {
        query[k] = v;
      });

      // ── Parse body ──────────────────────────────────────────
      let body: unknown = null;
      if (["post", "patch", "put"].includes(method)) {
        try {
          body = await request.json();
        } catch {
          body = null;
        }
      }

      // ── Record call ─────────────────────────────────────────
      const call: SpyCall = {
        body,
        params: params as Record<string, string | readonly string[]>,
        query,
        url: request.url,
      };
      spy.calls.push(call);

      // ── Update last-call shortcuts ──────────────────────────
      spy.called = true;
      spy.body = body;
      spy.params = call.params;
      spy.url = call.url;

      // ── Delay ───────────────────────────────────────────────
      if (options.delay) await mswDelay(options.delay);

      // ── Response ────────────────────────────────────────────
      const status = options.status ?? statusForMethod(method);

      if (status === 204) return new HttpResponse(null, { status });
      if (status >= 400) return HttpResponse.json(options.body ?? { message: "Error" }, { status });
      return HttpResponse.json(options.body ?? null, { status });
    });

    server.use(handler);
    return spy;
  }
  return mount as MountFn;
}
