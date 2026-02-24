/**
 * Test data factories for creating realistic test objects.
 *
 * Each factory returns a valid default object. Pass partial overrides
 * to customise specific fields:
 *
 * @example
 * ```ts
 * const exp = createExperiment({ name: "My test", status: "archived" });
 * ```
 */
import type { Experiment, TransferRequest, ExperimentAccess } from "@repo/api";

// ── Experiment ──────────────────────────────────────────────────

let experimentSeq = 0;

export function createExperiment(overrides: Partial<Experiment> = {}): Experiment {
  experimentSeq++;
  return {
    id: `exp-${experimentSeq}-${crypto.randomUUID().slice(0, 8)}`,
    name: `Experiment ${experimentSeq}`,
    description: `Description for experiment ${experimentSeq}`,
    status: "active",
    visibility: "private",
    createdBy: "user-1",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-15T00:00:00.000Z",
    embargoUntil: "2025-12-31T23:59:59.999Z",
    ownerFirstName: "John",
    ownerLastName: "Doe",
    ...overrides,
  };
}

// ── Transfer Request ────────────────────────────────────────────

let transferSeq = 0;

export function createTransferRequest(overrides: Partial<TransferRequest> = {}): TransferRequest {
  transferSeq++;
  return {
    requestId: `req-${transferSeq}-${crypto.randomUUID().slice(0, 8)}`,
    userId: "user-1",
    userEmail: "test@example.com",
    sourcePlatform: "photosynq",
    projectIdOld: `old-project-${transferSeq}`,
    projectUrlOld: `https://photosynq.com/projects/old-project-${transferSeq}`,
    status: "pending",
    requestedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Experiment Access ───────────────────────────────────────────

export function createExperimentAccess(
  overrides: Partial<ExperimentAccess> & { experiment?: Partial<Experiment> } = {},
): ExperimentAccess {
  const { experiment: experimentOverrides, ...accessOverrides } = overrides;
  return {
    experiment: createExperiment(experimentOverrides),
    hasAccess: true,
    isAdmin: false,
    ...accessOverrides,
  };
}

// ── Session / Auth ──────────────────────────────────────────────

export function createSession(
  overrides: Partial<{
    user: {
      id: string;
      name: string;
      email: string;
      registered: boolean;
      firstName: string;
      lastName: string;
    };
  }> = {},
) {
  return {
    user: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      registered: true,
      firstName: "Test",
      lastName: "User",
      ...overrides.user,
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────

/** Reset sequence counters — useful in beforeEach if deterministic IDs matter */
export function resetFactories() {
  experimentSeq = 0;
  transferSeq = 0;
}
