<!--
SYNC IMPACT REPORT
==================
Version Change: Initial → 1.0.0
Constitution Created: 2025-10-17
Change Type: INITIAL - First constitution establishment

Principle Summary:
- I. Monorepo Architecture - Defines workspace structure and package organization
- II. Test-First Development - Mandates test-driven development practices
- III. Type Safety & Validation - Enforces TypeScript strict mode and runtime validation
- IV. Observability & Monitoring - Requires structured logging and error tracking
- V. Research Data Integrity - Ensures scientific data quality and traceability
- VI. API-First Design - Mandates contract-first development with OpenAPI/Swagger
- VII. Incremental Feature Delivery - Requires user-story-driven, independently testable features

Template Consistency Status:
✅ spec-template.md - Aligned with user story principles and test requirements
✅ plan-template.md - Aligned with constitution check gates and project structure
✅ tasks-template.md - Aligned with test-first and incremental delivery principles
✅ agent-file-template.md - No constitution-specific references needed
✅ checklist-template.md - No constitution-specific references needed

Follow-up Items:
- None - all placeholders filled with concrete values
- Ratification date set to constitution creation date
- Version 1.0.0 represents initial stable governance framework
-->

# OpenJII Platform Constitution

## Core Principles

### I. Monorepo Architecture

**Rule**: All features MUST be developed within the monorepo structure using workspaces
(`apps/` for deployable applications, `packages/` for shared libraries).

**Requirements**:
- Shared code MUST be extracted to `packages/` and properly versioned
- Each package MUST have clear boundaries and a single responsibility
- Cross-package dependencies MUST be explicit in `package.json`
- No circular dependencies between packages

**Rationale**: The OpenJII platform serves diverse research needs (data collection,
processing, visualization). A monorepo enables code sharing across web, mobile, and
backend while maintaining independent deployability. This architecture supports the
scientific workflow where data models, API contracts, and UI components must stay
synchronized.

### II. Test-First Development (NON-NEGOTIABLE)

**Rule**: Tests MUST be written and approved BEFORE implementation begins. Tests MUST
fail initially, confirming they test the intended behavior.

**Requirements**:
- Follow Red-Green-Refactor cycle: Write test → Test fails → Implement → Test passes → Refactor
- Contract tests required for all API endpoints (using OpenAPI specs)
- Integration tests required for critical research data flows
- Unit tests required for business logic and data transformations
- Test coverage MUST be tracked via Codecov (visible in repository)

**Rationale**: Research software requires high reliability. Sensor data collection and
analysis directly impacts scientific conclusions. Test-first development ensures
specifications are clear before coding begins, catches regressions early, and serves as
living documentation for complex scientific workflows.

### III. Type Safety & Validation

**Rule**: All code MUST use TypeScript strict mode. All runtime data MUST be validated
with Zod schemas.

**Requirements**:
- `strict: true` in all `tsconfig.json` files
- API requests/responses MUST have Zod schemas
- Database models MUST use Drizzle ORM with type-safe queries
- No `any` types without explicit justification in code review
- Shared types MUST be defined in `packages/` for cross-app consistency

**Rationale**: Scientific data pipelines handle diverse sensor formats (MultispeQ
devices, custom IoT sensors). Type safety catches data structure mismatches at compile
time. Runtime validation with Zod ensures invalid sensor data is caught and logged
rather than corrupting research datasets.

### IV. Observability & Monitoring

**Rule**: All applications and packages MUST implement structured logging and error
tracking for production debugging.

**Requirements**:
- Use structured logging (JSON format in production)
- Include context: timestamp, request ID, user ID (when applicable), operation name
- Error handling MUST log enough context to debug production issues
- Critical data operations (sensor data ingestion, pipeline processing) MUST be traced
- Performance metrics for data processing pipelines

**Rationale**: Research data collection happens in field environments with intermittent
connectivity. Structured logs enable post-hoc debugging when researchers report data
anomalies. Tracing sensor data from ingestion through processing pipelines to analysis
results is essential for scientific reproducibility.

### V. Research Data Integrity

**Rule**: All research data operations MUST maintain traceability, versioning, and
audit trails.

**Requirements**:
- Sensor data MUST retain original raw format alongside processed versions
- Data transformations MUST be versioned and reversible
- Pipeline processing MUST record: input version, algorithm version, parameters, output version
- Data deletions MUST be soft deletes with retention policies
- Breaking changes to data schemas MUST include migration scripts and backwards compatibility

**Rationale**: Scientific research requires reproducibility. Researchers must be able to
trace any analysis result back to original sensor readings, understand what processing
occurred, and reprocess with updated algorithms. Data integrity directly impacts
research validity and publication credibility.

### VI. API-First Design

**Rule**: All backend services MUST define API contracts using OpenAPI/Swagger BEFORE
implementation. Frontend and backend development can then proceed in parallel.

**Requirements**:
- OpenAPI spec MUST be written and reviewed before endpoint implementation
- Use NestJS Swagger decorators to generate specs from code
- Contract tests MUST validate implementation matches spec
- Breaking API changes MUST follow semantic versioning
- Public APIs MUST maintain backwards compatibility or provide versioned endpoints

**Rationale**: The platform serves multiple clients (web app, mobile app, external
research tools). API-first design enables parallel frontend/backend development, ensures
consistent interfaces, and allows third-party integrations for research labs extending
the platform.

### VII. Incremental Feature Delivery

**Rule**: Features MUST be broken into independently testable user stories, prioritized
(P1, P2, P3...), and deliverable as incremental MVPs.

**Requirements**:
- Each user story MUST be independently implementable and testable
- P1 user story MUST deliver standalone value (MVP)
- Tasks MUST be organized by user story in `tasks.md`
- Feature branches MUST allow incremental merges (feature flags if needed)
- Each story completion MUST include validation before next story begins

**Rationale**: Research requirements evolve as scientists gain insights from data. Incremental
delivery allows early feedback on data collection workflows before building complex
analysis features. Scientists can begin using P1 functionality (data collection) while
P2 (advanced analysis) is still in development.

## Quality Gates

### Code Review Requirements

**Rule**: All pull requests MUST pass automated checks and human review before merging.

**Requirements**:
- All tests passing (unit, integration, contract)
- No TypeScript errors (`pnpm typecheck`)
- Linting rules passing (`pnpm lint`)
- Code coverage maintained or improved (checked by Codecov)
- At least one approving review from a maintainer
- Constitution compliance verified (reviewer checklist)

### Breaking Change Protocol

**Rule**: Breaking changes MUST be explicitly justified, documented, and migrated.

**Requirements**:
- Document what breaks and why simpler alternatives are insufficient
- Provide migration guide for dependent code
- Update affected documentation
- Coordinate with users for data schema changes
- Version bump follows semantic versioning (MAJOR for breaking changes)

## Development Workflow

### Feature Development Process

1. **Specify** (`/speckit.specify`): Define feature with user stories and acceptance criteria
2. **Plan** (`/speckit.plan`): Design architecture, choose technologies, run constitution check
3. **Task Breakdown** (`/speckit.tasks`): Create dependency-ordered, user-story-organized task list
4. **Implement**: Follow test-first, complete user stories in priority order
5. **Review**: Verify constitution compliance, tests passing, coverage maintained
6. **Deploy**: Incremental rollout with monitoring

### Constitution Compliance Review

Each plan and pull request MUST verify:
- ✅ Monorepo structure followed (code in correct `apps/` or `packages/` location)
- ✅ Tests written first and initially failing
- ✅ TypeScript strict mode enabled, Zod validation for runtime data
- ✅ Structured logging and error handling implemented
- ✅ Research data operations maintain integrity and traceability
- ✅ API contracts defined before implementation (OpenAPI/Swagger)
- ✅ Features broken into independently testable user stories

Any violations MUST be justified in the "Complexity Tracking" section of `plan.md` with:
- What rule is being violated
- Why it's necessary for this specific feature
- What simpler alternatives were considered and rejected

## Governance

### Amendment Process

**Rule**: Constitution amendments require documented rationale, version bump, and
template synchronization.

**Requirements**:
- Propose amendment via GitHub issue with justification
- Discuss with maintainers and affected developers
- Document impact on existing practices
- Update constitution version following semantic versioning:
  - **MAJOR**: Principle removal or incompatible redefinition
  - **MINOR**: New principle or materially expanded guidance
  - **PATCH**: Clarifications, wording fixes, non-semantic refinements
- Synchronize all templates (spec, plan, tasks, commands)
- Update agent guidance files if agent-specific references change
- Add sync impact report (HTML comment) at top of constitution file
- Commit message format: `docs: amend constitution to vX.Y.Z (summary of changes)`

### Version Control

**Version**: 1.0.0 | **Ratified**: 2025-10-17 | **Last Amended**: 2025-10-17
