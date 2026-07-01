import { assertSuccess } from "../common/utils/fp-utils";
import { ExperimentRepository } from "../experiments/core/repositories/experiment.repository";
import { MacroRepository } from "../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../protocols/core/repositories/protocol.repository";
import { TestHarness } from "../test/test-harness";
import { UserRepository } from "../users/core/repositories/user.repository";

/**
 * Exhaustive field-coverage check: every field each repo's `findAll`/`search` matches against,
 * driven through the real repository code against Postgres. Global search delegates to these same
 * `findAll` methods, so this covers both per-entity and global matching. Tokens are deliberately
 * rare and non-overlapping so a hit can only come from the field under test.
 */
describe("Search field coverage (per-entity repositories)", () => {
  const testApp = TestHarness.App;
  let experimentRepo: ExperimentRepository;
  let protocolRepo: ProtocolRepository;
  let macroRepo: MacroRepository;
  let userRepo: UserRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    experimentRepo = testApp.module.get(ExperimentRepository);
    protocolRepo = testApp.module.get(ProtocolRepository);
    macroRepo = testApp.module.get(MacroRepository);
    userRepo = testApp.module.get(UserRepository);
    userId = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const searchExperiments = async (q: string, asUser: string = userId) => {
    const r = await experimentRepo.findAll(asUser, undefined, undefined, q, 20);
    assertSuccess(r);
    return r.value.map((e) => e.name);
  };
  const searchProtocols = async (q: string) => {
    const r = await protocolRepo.findAll(q, undefined, undefined, 20);
    assertSuccess(r);
    return r.value.map((p) => p.name);
  };
  const searchMacros = async (q: string) => {
    const r = await macroRepo.findAll({ search: q }, 20);
    assertSuccess(r);
    return r.value.map((m) => m.name);
  };
  const searchUsers = async (q: string) => {
    const r = await userRepo.search({ query: q, limit: 20 });
    assertSuccess(r);
    return r.value;
  };

  // ── Experiments: name, description, creator, members, locations + FTS behaviours + access ──
  describe("experiments", () => {
    it("matches the name", async () => {
      await testApp.createExperiment({ name: "Photosynthesis trial alpha", userId });
      expect(await searchExperiments("photosynthesis")).toContain("Photosynthesis trial alpha");
    });

    it("matches the description", async () => {
      await testApp.createExperiment({
        name: "Znox baseline study",
        description: "measures chlorophyll fluorescence in leaves",
        userId,
      });
      expect(await searchExperiments("chlorophyll")).toContain("Znox baseline study");
    });

    it("matches the creator's name", async () => {
      const creator = await testApp.createTestUser({ name: "Gregor Mendel" });
      await testApp.createExperiment({ name: "Quokka observation", userId: creator });
      // Search as the creator (who has access via admin membership).
      expect(await searchExperiments("mendel", creator)).toContain("Quokka observation");
    });

    it("matches a (non-creator) member's name", async () => {
      const member = await testApp.createTestUser({ name: "Wallace Darwin" });
      const { experiment } = await testApp.createExperiment({ name: "Marmot census", userId });
      await testApp.addExperimentMember(experiment.id, member, "member");
      // "wallace" matches only the member (creator is a different, faker-named user).
      expect(await searchExperiments("wallace")).toContain("Marmot census");
    });

    it("matches every location field (name/country/region/municipality/address)", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Tapir habitat", userId });
      await testApp.addExperimentLocation({
        experimentId: experiment.id,
        name: "Northridge Station",
        country: "Zedland",
        region: "Quibble Valley",
        municipality: "Flergborough",
        addressLabel: "42 Wombat Avenue",
      });
      expect(await searchExperiments("northridge")).toContain("Tapir habitat"); // location name
      expect(await searchExperiments("zedland")).toContain("Tapir habitat"); // country
      expect(await searchExperiments("quibble")).toContain("Tapir habitat"); // region
      expect(await searchExperiments("flergborough")).toContain("Tapir habitat"); // municipality
      expect(await searchExperiments("wombat")).toContain("Tapir habitat"); // address label
    });

    it("does prefix matching (photosyn -> Photosynthesis)", async () => {
      await testApp.createExperiment({ name: "Spectral reflectance assay", userId });
      expect(await searchExperiments("spectr")).toContain("Spectral reflectance assay");
    });

    it("does stemming (run -> Running)", async () => {
      await testApp.createExperiment({ name: "Running field trials", userId });
      expect(await searchExperiments("run")).toContain("Running field trials");
    });

    it("tolerates a typo via trigram (bioluminecence -> Bioluminescence)", async () => {
      await testApp.createExperiment({ name: "Bioluminescence", userId });
      expect(await searchExperiments("bioluminecence")).toContain("Bioluminescence");
    });

    it("matches names containing punctuation (ridge-01)", async () => {
      await testApp.createExperiment({ name: "Ridge-01 canopy", userId });
      expect(await searchExperiments("ridge-01")).toContain("Ridge-01 canopy");
    });

    it("hides private experiments from non-members but shows public ones", async () => {
      const other = await testApp.createTestUser({});
      await testApp.createExperiment({
        name: "Secret photosynthesis lab",
        userId: other,
        visibility: "private",
      });
      await testApp.createExperiment({
        name: "Open photosynthesis garden",
        userId: other,
        visibility: "public",
      });
      const names = await searchExperiments("photosynthesis");
      expect(names).toContain("Open photosynthesis garden");
      expect(names).not.toContain("Secret photosynthesis lab");
    });

    it("excludes archived experiments by default", async () => {
      await testApp.createExperiment({
        name: "Archived photosynthesis run",
        userId,
        status: "archived",
      });
      expect(await searchExperiments("photosynthesis")).not.toContain(
        "Archived photosynthesis run",
      );
    });

    it("excludes a deactivated creator/member from name matching", async () => {
      const ghost = await testApp.createTestUser({ name: "Phantom Ghostly", activated: false });
      await testApp.createExperiment({
        name: "Routine survey",
        userId: ghost,
        visibility: "public",
      });
      // The experiment is public (so access passes) but its only person is deactivated.
      expect(await searchExperiments("ghostly")).not.toContain("Routine survey");
    });
  });

  // ── Protocols: name, description, creator, family ──
  describe("protocols", () => {
    it("matches the name", async () => {
      await testApp.createProtocol({ name: "Spectral calibration protocol", createdBy: userId });
      expect(await searchProtocols("calibration")).toContain("Spectral calibration protocol");
    });

    it("matches the description", async () => {
      await testApp.createProtocol({
        name: "Wibble routine",
        description: "for canopy reflectance scans",
        createdBy: userId,
      });
      expect(await searchProtocols("reflectance")).toContain("Wibble routine");
    });

    it("matches the creator's name", async () => {
      const creator = await testApp.createTestUser({ name: "Carl Linnaeus" });
      await testApp.createProtocol({ name: "Gloop measurement", createdBy: creator });
      expect(await searchProtocols("linnaeus")).toContain("Gloop measurement");
    });

    it("matches the family enum (multispeq / ambit)", async () => {
      await testApp.createProtocol({
        name: "Vorple leaf scan",
        family: "multispeq",
        createdBy: userId,
      });
      await testApp.createProtocol({ name: "Quux probe", family: "ambit", createdBy: userId });
      expect(await searchProtocols("multispeq")).toContain("Vorple leaf scan");
      expect(await searchProtocols("ambit")).toContain("Quux probe");
    });

    it("does prefix matching (spectr -> Spectral)", async () => {
      await testApp.createProtocol({ name: "Spectral assay protocol", createdBy: userId });
      expect(await searchProtocols("spectr")).toContain("Spectral assay protocol");
    });

    it("does stemming (run -> Running)", async () => {
      await testApp.createProtocol({ name: "Running calibration", createdBy: userId });
      expect(await searchProtocols("run")).toContain("Running calibration");
    });

    it("tolerates a typo via trigram (bioluminecence -> Bioluminescence)", async () => {
      await testApp.createProtocol({ name: "Bioluminescence", createdBy: userId });
      expect(await searchProtocols("bioluminecence")).toContain("Bioluminescence");
    });

    it("matches names containing punctuation (ridge-01)", async () => {
      await testApp.createProtocol({ name: "Ridge-01 canopy protocol", createdBy: userId });
      expect(await searchProtocols("ridge-01")).toContain("Ridge-01 canopy protocol");
    });

    it("excludes a deactivated creator from name matching", async () => {
      const ghost = await testApp.createTestUser({ name: "Spectral Ghoul", activated: false });
      await testApp.createProtocol({ name: "Bland notes", createdBy: ghost });
      expect(await searchProtocols("ghoul")).not.toContain("Bland notes");
    });
  });

  // ── Macros: name, description, creator, language ──
  describe("macros", () => {
    it("matches the name", async () => {
      await testApp.createMacro({ name: "Calibration helper macro", createdBy: userId });
      expect(await searchMacros("calibration")).toContain("Calibration helper macro");
    });

    it("matches the description", async () => {
      await testApp.createMacro({
        name: "Snarf tool",
        description: "computes transpiration index",
        createdBy: userId,
      });
      expect(await searchMacros("transpiration")).toContain("Snarf tool");
    });

    it("matches the creator's name", async () => {
      const creator = await testApp.createTestUser({ name: "Rosalind Franklin" });
      await testApp.createMacro({ name: "Blorp utility", createdBy: creator });
      expect(await searchMacros("franklin")).toContain("Blorp utility");
    });

    it("matches the language enum (python / javascript)", async () => {
      await testApp.createMacro({
        name: "Frobnicate utility",
        language: "python",
        createdBy: userId,
      });
      await testApp.createMacro({
        name: "Glorp widget",
        language: "javascript",
        createdBy: userId,
      });
      expect(await searchMacros("python")).toContain("Frobnicate utility");
      expect(await searchMacros("javascript")).toContain("Glorp widget");
    });

    it("does prefix matching (spectr -> Spectral)", async () => {
      await testApp.createMacro({ name: "Spectral analysis macro", createdBy: userId });
      expect(await searchMacros("spectr")).toContain("Spectral analysis macro");
    });

    it("does stemming (run -> Running)", async () => {
      await testApp.createMacro({ name: "Running average macro", createdBy: userId });
      expect(await searchMacros("run")).toContain("Running average macro");
    });

    it("tolerates a typo via trigram (bioluminecence -> Bioluminescence)", async () => {
      await testApp.createMacro({ name: "Bioluminescence", createdBy: userId });
      expect(await searchMacros("bioluminecence")).toContain("Bioluminescence");
    });

    it("matches names containing punctuation (ridge-01)", async () => {
      await testApp.createMacro({ name: "Ridge-01 canopy macro", createdBy: userId });
      expect(await searchMacros("ridge-01")).toContain("Ridge-01 canopy macro");
    });

    it("excludes a deactivated creator from name matching", async () => {
      const ghost = await testApp.createTestUser({ name: "Calib Wraith", activated: false });
      await testApp.createMacro({ name: "Hidden gizmo", createdBy: ghost });
      expect(await searchMacros("wraith")).not.toContain("Hidden gizmo");
    });
  });

  // ── Users: firstName, lastName, email + typo + exclusions ──
  describe("users", () => {
    it("matches the first name", async () => {
      await testApp.createTestUser({ name: "Barnaby Figglesworth", email: "barnaby@example.com" });
      expect((await searchUsers("barnaby")).some((u) => u.firstName === "Barnaby")).toBe(true);
    });

    it("matches the last name", async () => {
      await testApp.createTestUser({ name: "Barnaby Figglesworth", email: "barnaby2@example.com" });
      expect((await searchUsers("figglesworth")).some((u) => u.lastName === "Figglesworth")).toBe(
        true,
      );
    });

    it("matches the email", async () => {
      const id = await testApp.createTestUser({
        name: "Zelda Quux",
        email: "zorptastic@example.com",
      });
      expect((await searchUsers("zorptastic")).some((u) => u.userId === id)).toBe(true);
    });

    it("tolerates a typo via trigram (thornbery -> Thornberry)", async () => {
      await testApp.createTestUser({ name: "Maxwell Thornberry", email: "maxwell@example.com" });
      expect((await searchUsers("thornbery")).some((u) => u.lastName === "Thornberry")).toBe(true);
    });

    it("matches a name prefix via substring (barn -> Barnaby)", async () => {
      // User search has no tsvector — matching is trigram + ILIKE substring, so there is no FTS
      // stemming/prefix here; a prefix works because it is a substring of the full name.
      await testApp.createTestUser({
        name: "Barnaby Figglesworth",
        email: "prefixcase@example.com",
      });
      expect((await searchUsers("barn")).some((u) => u.firstName === "Barnaby")).toBe(true);
    });

    it("excludes deactivated and soft-deleted users", async () => {
      await testApp.createTestUser({
        name: "Ghosty Inactive",
        email: "inactive@example.com",
        activated: false,
      });
      await testApp.createTestUser({
        name: "Removed Person",
        email: "removed@example.com",
        deletedAt: new Date(),
      });
      expect((await searchUsers("ghosty")).some((u) => u.firstName === "Ghosty")).toBe(false);
      expect((await searchUsers("removed")).some((u) => u.firstName === "Removed")).toBe(false);
    });
  });
});
