import { assertSuccess } from "../../../../common/utils/fp-utils";
import { UpdateMacroUseCase } from "../../../../macros/application/use-cases/update-macro/update-macro";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { UpdateProtocolUseCase } from "../../../../protocols/application/use-cases/update-protocol/update-protocol";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";
import { PublishVersionUseCase } from "../publish-version/publish-version";
import { IsWorkbookUpgradableUseCase } from "./is-workbook-upgradable";

function expectValue<T>(v: T | null | undefined): T {
  if (v == null) throw new Error("expected non-null value");
  return v;
}

/**
 * Protocols and macros are single shared rows referenced by id from workbook
 * cells; there is no per-workbook copy. This suite pins down what that means
 * across two workbooks that reference the same entity: the "if I edit my
 * protocol, what happens to the other workbook / to experiments?" question.
 *
 * The load-bearing facts it proves:
 *  - Editing the entity mutates the one shared row, so EVERY workbook that
 *    references it (even one owned by someone else, whose owner did nothing)
 *    immediately reports drift (isUpgradable === true).
 *  - Editing "from the workbook page" and editing the entity "directly" are the
 *    same UpdateProtocolUseCase call; there is no workbook-scoped sandbox.
 *  - Published version snapshots stay frozen on the old code, so experiments
 *    pinned to them are NOT mutated until someone upgrades.
 *  - Upgrading one workbook advances only that workbook; the other still lags.
 *  - Re-running a workbook (output cells + per-run runtime fields) is NOT drift.
 */
describe("shared entity propagation across workbooks (integration)", () => {
  const testApp = TestHarness.App;
  let isUpgradableUseCase: IsWorkbookUpgradableUseCase;
  let publishVersion: PublishVersionUseCase;
  let updateProtocol: UpdateProtocolUseCase;
  let updateMacro: UpdateMacroUseCase;
  let workbookRepo: WorkbookRepository;
  let versionRepo: WorkbookVersionRepository;
  let protocolRepo: ProtocolRepository;
  let macroRepo: MacroRepository;

  // Owner of the shared entity + workbook WA; `otherId` owns only workbook WB.
  let ownerId: string;
  let otherId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    ownerId = await testApp.createTestUser({});
    otherId = await testApp.createTestUser({});
    isUpgradableUseCase = testApp.module.get(IsWorkbookUpgradableUseCase);
    publishVersion = testApp.module.get(PublishVersionUseCase);
    updateProtocol = testApp.module.get(UpdateProtocolUseCase);
    updateMacro = testApp.module.get(UpdateMacroUseCase);
    workbookRepo = testApp.module.get(WorkbookRepository);
    versionRepo = testApp.module.get(WorkbookVersionRepository);
    protocolRepo = testApp.module.get(ProtocolRepository);
    macroRepo = testApp.module.get(MacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const protocolCell = (protocolId: string, id = "p1") => ({
    id,
    type: "protocol" as const,
    isCollapsed: false,
    payload: { protocolId, version: 1 },
  });

  const macroCell = (macroId: string, id = "m1") => ({
    id,
    type: "macro" as const,
    isCollapsed: false,
    payload: { macroId, language: "python" as const },
  });

  /** Publish the workbook's current cells + live entity code as a new version. */
  async function publish(workbookId: string, userId: string) {
    const result = await publishVersion.execute(workbookId, userId);
    assertSuccess(result);
    return result.value;
  }

  /** isUpgradable is computed against the live draft + live entity code. */
  async function isUpgradable(workbookId: string): Promise<boolean> {
    const wb = await workbookRepo.findById(workbookId);
    assertSuccess(wb);
    const result = await isUpgradableUseCase.execute(expectValue(wb.value));
    assertSuccess(result);
    return result.value;
  }

  async function latestVersion(workbookId: string) {
    const result = await versionRepo.getLatestVersion(workbookId);
    assertSuccess(result);
    return expectValue(result.value);
  }

  async function protocolSnapshotCode(workbookId: string, protocolId: string) {
    const version = await latestVersion(workbookId);
    return (version.entitySnapshots.protocols[protocolId] as { code: unknown } | undefined)?.code;
  }

  async function macroSnapshotCode(workbookId: string, macroId: string) {
    const version = await latestVersion(workbookId);
    return (version.entitySnapshots.macros[macroId] as { code: string } | undefined)?.code;
  }

  const OLD_CODE = [{ label: "Phi2", pulses: [10, 20] }];
  const NEW_CODE = [{ label: "Phi2", pulses: [10, 30] }];

  it("editing a shared protocol flags every referencing workbook and freezes all snapshots", async () => {
    const protocol = await testApp.createProtocol({
      name: "Shared protocol",
      code: OLD_CODE,
      createdBy: ownerId,
    });
    // WA is owned by the protocol owner; WB by a different user. Both reference
    // the same protocol and are each published to v1.
    const wa = await testApp.createWorkbook({
      name: "WA (owner)",
      cells: [protocolCell(protocol.id)],
      createdBy: ownerId,
    });
    const wb = await testApp.createWorkbook({
      name: "WB (other user)",
      cells: [protocolCell(protocol.id)],
      createdBy: otherId,
    });
    await publish(wa.id, ownerId);
    await publish(wb.id, otherId);

    expect(await isUpgradable(wa.id)).toBe(false);
    expect(await isUpgradable(wb.id)).toBe(false);

    // Edit the protocol. This is the SAME call the protocol cell autosave makes
    // "from the workbook page" and the standalone protocol page makes
    // "directly": there is no workbook-scoped copy.
    assertSuccess(await updateProtocol.execute(protocol.id, { code: NEW_CODE }, ownerId));

    // The single shared row now holds the new code.
    const live = await protocolRepo.findOne(protocol.id);
    assertSuccess(live);
    expect(expectValue(live.value).code).toEqual(NEW_CODE);

    // BOTH workbooks report drift, including WB, whose owner did nothing.
    expect(await isUpgradable(wa.id)).toBe(true);
    expect(await isUpgradable(wb.id)).toBe(true);

    // BOTH published snapshots stay frozen on the old code, so any experiment
    // pinned to v1 keeps running the old protocol until it is upgraded.
    expect(await protocolSnapshotCode(wa.id, protocol.id)).toEqual(OLD_CODE);
    expect(await protocolSnapshotCode(wb.id, protocol.id)).toEqual(OLD_CODE);

    // The entity edit mints no workbook version on its own.
    expect((await latestVersion(wa.id)).version).toBe(1);
    expect((await latestVersion(wb.id)).version).toBe(1);
  });

  it("upgrading one workbook advances only it; the other still lags", async () => {
    const protocol = await testApp.createProtocol({
      name: "Shared protocol",
      code: OLD_CODE,
      createdBy: ownerId,
    });
    const wa = await testApp.createWorkbook({
      name: "WA (owner)",
      cells: [protocolCell(protocol.id)],
      createdBy: ownerId,
    });
    const wb = await testApp.createWorkbook({
      name: "WB (other user)",
      cells: [protocolCell(protocol.id)],
      createdBy: otherId,
    });
    await publish(wa.id, ownerId);
    await publish(wb.id, otherId);
    assertSuccess(await updateProtocol.execute(protocol.id, { code: NEW_CODE }, ownerId));

    // The owner upgrades WA (what the experiment design page / upgrade banner
    // does): a new version snapshots the current live code.
    await publish(wa.id, ownerId);

    expect((await latestVersion(wa.id)).version).toBe(2);
    expect(await isUpgradable(wa.id)).toBe(false);
    expect(await protocolSnapshotCode(wa.id, protocol.id)).toEqual(NEW_CODE);

    // WB is untouched: still on v1, still frozen on the old code, still drifted.
    expect((await latestVersion(wb.id)).version).toBe(1);
    expect(await isUpgradable(wb.id)).toBe(true);
    expect(await protocolSnapshotCode(wb.id, protocol.id)).toEqual(OLD_CODE);
  });

  it("re-running a workbook (output cells + per-run fields) is not drift", async () => {
    const protocol = await testApp.createProtocol({
      name: "Shared protocol",
      code: OLD_CODE,
      createdBy: ownerId,
    });
    const question = {
      id: "q1",
      type: "question" as const,
      isCollapsed: false,
      isAnswered: false,
      name: "reading",
      question: { kind: "open_ended" as const, text: "Value?", required: false },
    };
    const wb = await testApp.createWorkbook({
      name: "WB",
      cells: [protocolCell(protocol.id), question],
      createdBy: ownerId,
    });
    await publish(wb.id, ownerId);
    expect(await isUpgradable(wb.id)).toBe(false);

    // Mirror exactly what a run leaves in `cells`: an appended output cell and
    // per-run runtime fields on the question. designOf() strips both, so this
    // must NOT register as an upgrade (OJD-1626).
    await workbookRepo.update(wb.id, {
      cells: [
        protocolCell(protocol.id),
        { ...question, isAnswered: true, answer: "42" },
        {
          id: "out1",
          type: "output",
          isCollapsed: false,
          producedBy: "p1",
          data: { value: 42 },
          executionTime: 12,
          messages: [],
        },
      ],
    });

    expect(await isUpgradable(wb.id)).toBe(false);
  });

  it("editing a shared macro behaves identically to a shared protocol", async () => {
    const macro = await testApp.createMacro({
      name: "Shared macro",
      code: btoa("print('v0')"),
      createdBy: ownerId,
    });
    const wa = await testApp.createWorkbook({
      name: "WA (owner)",
      cells: [macroCell(macro.id)],
      createdBy: ownerId,
    });
    const wb = await testApp.createWorkbook({
      name: "WB (other user)",
      cells: [macroCell(macro.id)],
      createdBy: otherId,
    });
    await publish(wa.id, ownerId);
    await publish(wb.id, otherId);

    expect(await isUpgradable(wa.id)).toBe(false);
    expect(await isUpgradable(wb.id)).toBe(false);

    const newCode = btoa("print('v1')");
    // Macro updates are owner-gated, so the edit runs as the macro's owner.
    assertSuccess(await updateMacro.execute(macro.id, { code: newCode }, ownerId));

    const live = await macroRepo.findById(macro.id);
    assertSuccess(live);
    expect(expectValue(live.value).code).toBe(newCode);

    expect(await isUpgradable(wa.id)).toBe(true);
    expect(await isUpgradable(wb.id)).toBe(true);

    expect(await macroSnapshotCode(wa.id, macro.id)).toBe(btoa("print('v0')"));
    expect(await macroSnapshotCode(wb.id, macro.id)).toBe(btoa("print('v0')"));
  });
});
