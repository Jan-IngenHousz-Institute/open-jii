import { Controller, Injectable, Logger } from "@nestjs/common";
import type { CallHandler, CanActivate, ExecutionContext, INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { Test } from "@nestjs/testing";
import { oc } from "@orpc/contract";
import { Implement, implement, ORPCError, ORPCModule } from "@orpc/nest";
import { PostHog } from "posthog-node";
import { from, lastValueFrom } from "rxjs";
import request from "supertest";
import type { App } from "supertest/types";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AnalyticsConfigService } from "../config/config.service";
import { ErrorContextInterceptor } from "./error-context.interceptor";
import { ErrorReporterService } from "./error-reporter.service";
import { OrpcErrorInterceptor } from "./orpc-error.interceptor";

// A real client, so the test proves the context survives the awaits a handler makes.
const posthog = new PostHog("phc_test", { host: "http://127.0.0.1:9", disabled: true });

class ReporterUnderTest extends ErrorReporterService {
  protected override getPostHogClient() {
    return posthog;
  }
}

const reporter = new ReporterUnderTest(
  new AnalyticsConfigService(
    new ConfigService({
      analytics: { posthogKey: "phc_test", posthogHost: "https://eu.i.posthog.com" },
    }),
  ),
);
const interceptor = new ErrorContextInterceptor(reporter);

function httpContextFor(request: object): ExecutionContext {
  return new ExecutionContextHost([request, {}, () => undefined]);
}

// Who and which request a report would count against, as posthog-node resolves it when it captures.
function currentContext() {
  const context = posthog.getContext();
  const requestId: unknown = context?.properties?.request_id;
  return { distinctId: context?.distinctId, requestId };
}

// Reads the context the way a report made deep inside a handler would, after an await.
const handler: CallHandler = {
  handle: () =>
    from(
      (async () => {
        await Promise.resolve();
        return currentContext();
      })(),
    ),
};

afterAll(async () => {
  await posthog.shutdown();
});

describe("ErrorContextInterceptor", () => {
  it("runs the handler as the signed-in user and the request's id", async () => {
    const context = httpContextFor({ user: { id: "user-1" }, id: "req-1" });

    await expect(lastValueFrom(interceptor.intercept(context, handler))).resolves.toEqual({
      distinctId: "user-1",
      requestId: "req-1",
    });
  });

  it("runs an anonymous request under its id alone", async () => {
    const context = httpContextFor({ id: "req-2" });

    await expect(lastValueFrom(interceptor.intercept(context, handler))).resolves.toEqual({
      distinctId: undefined,
      requestId: "req-2",
    });
  });
});

// The same wiring as the app: a global guard, this interceptor, and oRPC reporting through its own.
describe("ErrorContextInterceptor, through a real oRPC route", () => {
  const failing = oc.route({ method: "GET", path: "/failing" });

  @Controller()
  class FailingController {
    @Implement(failing)
    fail() {
      return implement(failing).handler(async () => {
        await Promise.resolve();
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      });
    }
  }

  // Stands in for the Better Auth guard, which puts the user on the request.
  @Injectable()
  class SignedInGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest<{ user?: object; id?: string }>();
      request.user = { id: "user-1" };
      request.id = "req-1";
      return true;
    }
  }

  class ContextRecorder extends ReporterUnderTest {
    readonly reportedAs: ReturnType<typeof currentContext>[] = [];

    override report(): void {
      this.reportedAs.push(currentContext());
    }
  }

  const recorder = new ContextRecorder(
    new AnalyticsConfigService(
      new ConfigService({
        analytics: { posthogKey: "phc_test", posthogHost: "https://eu.i.posthog.com" },
      }),
    ),
  );
  let app: INestApplication<App>;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      imports: [
        ORPCModule.forRoot({ interceptors: [new OrpcErrorInterceptor(recorder).intercept] }),
      ],
      controllers: [FailingController],
      providers: [
        { provide: APP_GUARD, useClass: SignedInGuard },
        { provide: APP_INTERCEPTOR, useValue: new ErrorContextInterceptor(recorder) },
      ],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports an oRPC server error against the signed-in user and the request's id", async () => {
    await request(app.getHttpServer()).get("/failing").expect(500);

    expect(recorder.reportedAs).toEqual([{ distinctId: "user-1", requestId: "req-1" }]);
  });
});
