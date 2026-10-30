import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { guestGatedProcedures, guestMayUse } from "./guest-access";
import type { GuestGatedProcedure } from "./guest-access";

const read = (name: string) =>
  JSON.parse(
    readFileSync(
      resolve(__dirname, "../../../backend/src/authorization/core/models", name),
      "utf8",
    ),
  ) as { procedure: string; classification: string }[];
const inventory = [...read("guest-routes.json"), ...read("guest-native-routes.json")];

const BETTER_AUTH_ROUTES = new Set(["organization.create"]);

const decoratedRoutes: Partial<Record<GuestGatedProcedure, [string, string]>> = {
  "experiments.listExperimentDevices": [
    "iot/presentation/experiment-device.controller.ts",
    "listExperimentDevices",
  ],
  "experiments.addAnnotation": [
    "experiments/presentation/experiment-data-annotations.controller.ts",
    "addAnnotation",
  ],
  "experiments.initiateExport": [
    "experiments/presentation/experiment-data-exports.controller.ts",
    "initiateExport",
  ],
  "ExperimentDataUploadsController.uploadData": [
    "experiments/presentation/experiment-data-uploads.controller.ts",
    "uploadData",
  ],
};

function decoratedGuestAccess(file: string, method: string): boolean {
  const source = ts.createSourceFile(
    file,
    readFileSync(resolve(__dirname, "../../../backend/src", file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = source.statements
    .filter(ts.isClassDeclaration)
    .flatMap((controller) => [...controller.members])
    .filter(ts.isMethodDeclaration)
    .find((member) => member.name.getText(source) === method);
  if (!declaration) throw new Error(`Missing backend method ${file}:${method}`);
  const requirement = ts.getDecorators(declaration)?.find((decorator) => {
    const call = decorator.expression;
    return ts.isCallExpression(call) && call.expression.getText(source) === "CanAccess";
  })?.expression;
  if (!requirement || !ts.isCallExpression(requirement)) {
    throw new Error(`Missing CanAccess requirement on ${file}:${method}`);
  }
  const metadata = requirement.arguments.at(0);
  if (!metadata || !ts.isObjectLiteralExpression(metadata)) {
    throw new Error(`Expected literal CanAccess metadata on ${file}:${method}`);
  }
  expect(metadata.properties.every(ts.isPropertyAssignment)).toBe(true);
  const guest = metadata.properties.find((property) => property.name?.getText(source) === "guest");
  if (!guest) return false;
  if (!ts.isPropertyAssignment(guest)) throw new Error("Expected a literal guest opt-in");
  expect([ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword]).toContain(guest.initializer.kind);
  return guest.initializer.kind === ts.SyntaxKind.TrueKeyword;
}

describe("guestMayUse", () => {
  it.each(guestGatedProcedures.filter((procedure) => !BETTER_AUTH_ROUTES.has(procedure)))(
    "agrees with the backend's guest policy on %s",
    (procedure) => {
      const decorated = decoratedRoutes[procedure];
      if (decorated) {
        expect(guestMayUse(procedure, true)).toBe(decoratedGuestAccess(...decorated));
        return;
      }
      const route = inventory.find((entry) => entry.procedure === procedure);
      expect(route, `${procedure} is not in the guest route inventories`).toBeDefined();
      expect(guestMayUse(procedure, true)).toBe(route?.classification !== "deny");
    },
  );

  it("never hides anything from a researcher", () => {
    for (const procedure of guestGatedProcedures) {
      expect(guestMayUse(procedure, false)).toBe(true);
    }
  });

  it("allows an action with no backend procedure behind it", () => {
    expect(guestMayUse(undefined, true)).toBe(true);
  });
});
