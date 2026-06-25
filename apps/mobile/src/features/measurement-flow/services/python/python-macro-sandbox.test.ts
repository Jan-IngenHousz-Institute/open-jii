import { describe, expect, it, vi } from "vitest";

import {
  MACRO_HELPER_NAMES,
  buildMacroProgram,
  buildPythonMacroSandboxHtml,
} from "./python-macro-sandbox";

// The raw `.txt` import has no Node loader; stub it (the builders under test
// take the source as an argument, so the asset value is irrelevant here).
vi.mock("./macro-helpers.py.txt", () => ({ default: "mock-helpers-asset" }));
vi.mock("expo-asset", () => ({
  Asset: { fromModule: vi.fn(() => ({ downloadAsync: vi.fn(() => Promise.resolve()), uri: "x" })) },
}));
vi.mock("expo-file-system", () => ({
  File: class {
    text() {
      return Promise.resolve("");
    }
  },
}));

describe("buildMacroProgram", () => {
  const program = buildMacroProgram("return danger('bad', output)", "eyJhIjoxfQ==");

  it("wraps the macro in execute_macro and indents its body", () => {
    expect(program).toContain("def execute_macro():");
    expect(program).toContain("    return danger('bad', output)");
  });

  it("exposes `json` (the input row) and an empty `output`, matching wrapper.py", () => {
    expect(program).toContain("json = __json_input__");
    expect(program).toContain("output = {}");
  });

  it("merges a dict return into output and serialises output as the result", () => {
    expect(program).toContain("if isinstance(__macro_result__, dict):");
    expect(program).toContain("    output.update(__macro_result__)");
    expect(program).toContain("__result_holder__.result = __jsonmod__.dumps(output)");
  });

  it("decodes the passed json payload", () => {
    expect(program).toContain('__b64__.b64decode("eyJhIjoxfQ==")');
  });
});

describe("buildPythonMacroSandboxHtml", () => {
  it("imports the helpers as a module and binds every helper name as a global", () => {
    const html = buildPythonMacroSandboxHtml("# helpers");
    expect(html).toContain("pyodide.FS.writeFile('jii_macro_helpers.py', HELPERS_SRC)");
    expect(html).toContain("import jii_macro_helpers");
    expect(html).toContain("from jii_macro_helpers import ' + HELPER_NAMES");
    for (const name of ["danger", "info", "warning", "GetProtocolByLabel", "MathMEAN"]) {
      expect(MACRO_HELPER_NAMES).toContain(name);
    }
  });

  it("escapes `<` in the helper source so a stray </script> can't close the tag", () => {
    const html = buildPythonMacroSandboxHtml("LT_TEST = '<x>'");
    expect(html).toContain("LT_TEST = '\\u003cx>'");
    expect(html).not.toContain("LT_TEST = '<x>'");
  });
});
