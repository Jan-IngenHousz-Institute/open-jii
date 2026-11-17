import {
  eq,
  experimentDashboards,
  experimentVisualizations,
  experiments,
  organizationMembers,
  teams,
  teamMembers,
} from "@repo/database";

import { AuthorizationService } from "../../../authorization/authorization.service";
import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ExperimentDashboardRepository } from "./experiment-dashboard.repository";
import { ExperimentVisualizationRepository } from "./experiment-visualization.repository";

describe("experiment child search access parity", () => {
  const testApp = TestHarness.App;

  beforeAll(async () => {
    await testApp.setup();
  });
  beforeEach(async () => {
    await testApp.beforeEach();
  });
  afterEach(() => {
    testApp.afterEach();
  });
  afterAll(async () => {
    await testApp.teardown();
  });

  it("matches AuthorizationService.can for every user and child, except archived experiments", async () => {
    const userIds = {
      owner: await testApp.createTestUser(),
      outsider: await testApp.createTestUser(),
      orgMember: await testApp.createTestUser(),
      orgAdmin: await testApp.createTestUser(),
      userGrant: await testApp.createTestUser(),
      teamGrant: await testApp.createTestUser(),
      orgGrant: await testApp.createTestUser(),
      noOrganization: await testApp.createTestUser(),
      formerCreator: await testApp.createTestUser(),
    };
    const owningOrgId = await testApp.createOrganization();
    const outsideOrgId = await testApp.createOrganization();
    const teamOrgId = await testApp.createOrganization();
    const granteeOrgId = await testApp.createOrganization();
    for (const [userId, role] of [
      [userIds.owner, "owner"],
      [userIds.orgMember, "member"],
      [userIds.orgAdmin, "admin"],
    ]) {
      await testApp.database
        .insert(organizationMembers)
        .values({ organizationId: owningOrgId, userId, role });
    }
    await testApp.addOrganizationMember(outsideOrgId, userIds.outsider, "member");
    await testApp.addOrganizationMember(teamOrgId, userIds.teamGrant, "member");
    await testApp.addOrganizationMember(granteeOrgId, userIds.orgGrant, "member");
    const [team] = await testApp.database
      .insert(teams)
      .values({
        organizationId: teamOrgId,
        name: `Team ${crypto.randomUUID()}`,
      })
      .returning();
    await testApp.database
      .insert(teamMembers)
      .values({ teamId: team.id, userId: userIds.teamGrant });

    const token = crypto.randomUUID().replaceAll("-", "");
    const fixtures: {
      kind: string;
      experiment: { id: string };
      dashboard: { id: string };
      visualization: { id: string };
    }[] = [];
    for (const kind of [
      "private",
      "user",
      "team",
      "org",
      "public",
      "archived",
      "no-org",
      "former-creator",
    ] as const) {
      const { experiment } = await testApp.createExperiment({
        name: `Experiment ${kind} ${token}`,
        userId: kind === "former-creator" ? userIds.formerCreator : userIds.owner,
        organizationId: owningOrgId,
        visibility: kind === "public" ? "public" : "private",
        status: kind === "archived" ? "archived" : "active",
      });
      if (kind === "no-org") {
        await testApp.database
          .update(experiments)
          .set({ organizationId: null })
          .where(eq(experiments.id, experiment.id));
        await testApp.addResourceGrant({
          resourceType: "experiment",
          resourceId: experiment.id,
          granteeType: "user",
          granteeId: userIds.noOrganization,
          role: "viewer",
        });
      }
      const grantee =
        kind === "user"
          ? { granteeType: "user" as const, granteeId: userIds.userGrant }
          : kind === "team"
            ? { granteeType: "team" as const, granteeId: team.id }
            : kind === "org"
              ? { granteeType: "organization" as const, granteeId: granteeOrgId }
              : null;
      if (grantee) {
        await testApp.addResourceGrant({
          resourceType: "experiment",
          resourceId: experiment.id,
          role: "viewer",
          ...grantee,
        });
      }
      const name = `Canopy ${token}`;
      const [dashboard] = await testApp.database
        .insert(experimentDashboards)
        .values({
          experimentId: experiment.id,
          name,
          createdBy: userIds.owner,
        })
        .returning({ id: experimentDashboards.id });
      const [visualization] = await testApp.database
        .insert(experimentVisualizations)
        .values({
          experimentId: experiment.id,
          name,
          createdBy: userIds.owner,
          chartFamily: "basic",
          chartType: "bar",
          config: {},
          dataConfig: {},
        })
        .returning({ id: experimentVisualizations.id });
      fixtures.push({ kind, experiment, dashboard, visualization });
    }

    const authz = testApp.module.get(AuthorizationService);
    const dashboards = testApp.module.get(ExperimentDashboardRepository);
    const visualizations = testApp.module.get(ExperimentVisualizationRepository);
    const accessReasons = new Set<string>();
    for (const [userKind, userId] of Object.entries(userIds)) {
      const dashboardResult = await dashboards.search(token, userId, 32);
      const visualizationResult = await visualizations.search(token, userId, 32);
      assertSuccess(dashboardResult);
      assertSuccess(visualizationResult);
      for (const fixture of fixtures) {
        const decision = await authz.can(userId, {
          resourceType: "experiment",
          resourceId: fixture.experiment.id,
          action: "read",
        });
        accessReasons.add(decision.reason);
        const expected = decision.allow && fixture.kind !== "archived";
        for (const [kind, rows, id] of [
          ["dashboard", dashboardResult.value, fixture.dashboard.id],
          ["visualization", visualizationResult.value, fixture.visualization.id],
        ] as const) {
          expect(
            rows.some((row) => row.id === id),
            `${userKind} / ${fixture.kind} / ${kind}`,
          ).toBe(expected);
        }
      }
    }
    expect(accessReasons).toEqual(
      new Set([
        "org-role",
        "resource-grant:user",
        "resource-grant:team",
        "resource-grant:org",
        "public",
        "forbidden",
      ]),
    );
  });
});
