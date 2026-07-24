import { describe, expect, it } from "vitest";

import { DYNAMIC_COMMAND_ISSUE_CODES } from "@repo/api/transforms/dynamic-command-refs";

import deCommon from "../../../../packages/i18n/locales/de-DE/common.json";
import deExperiments from "../../../../packages/i18n/locales/de-DE/experiments.json";
import deWorkbook from "../../../../packages/i18n/locales/de-DE/workbook.json";
import enCommon from "../../../../packages/i18n/locales/en-US/common.json";
import enExperiments from "../../../../packages/i18n/locales/en-US/experiments.json";
import enWorkbook from "../../../../packages/i18n/locales/en-US/workbook.json";
import { dynamicCommandIssueKey, sourceTypeLabelKey } from "./dynamic-command-authoring";

// The supported, complete locale set for this surface.
const WORKBOOK = { "en-US": enWorkbook, "de-DE": deWorkbook } as const;
const EXPERIMENTS = { "en-US": enExperiments, "de-DE": deExperiments } as const;
const COMMON = { "en-US": enCommon, "de-DE": deCommon } as const;

function resolve(bundle: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object") return (node as Record<string, unknown>)[part];
    return undefined;
  }, bundle);
}

// Every visible/ARIA/repair string the authoring UI renders through tWorkbook.
const WORKBOOK_KEYS = [
  "cells.commandDynamic.modeGroup",
  "cells.commandDynamic.modeStatic",
  "cells.commandDynamic.modeDynamic",
  "cells.commandDynamic.tooltip",
  "cells.commandDynamic.readOnlyNote",
  "cells.commandDynamic.sourceLabel",
  "cells.commandDynamic.fieldLabel",
  "cells.commandDynamic.none",
  "cells.commandDynamic.sourcePickerLabel",
  "cells.commandDynamic.sourceAria",
  "cells.commandDynamic.sourcePlaceholder",
  "cells.commandDynamic.sourceUnavailable",
  "cells.commandDynamic.questionNote",
  "cells.commandDynamic.fieldPlaceholder",
  "cells.commandDynamic.fieldAria",
];

// Source type labels drive both the unnamed-source fallback and the visible
// type suffix (no raw enum text may be rendered).
const SOURCE_TYPES = ["protocol", "macro", "command", "question", "unknown-type"];

const EXPERIMENTS_KEYS = [
  "flow.upgradeDiff.serverRejected",
  "flow.structuralAttach.title",
  "flow.structuralAttach.openWorkbook",
];

// New-experiment attach reports creation and attachment as separate outcomes,
// with a durable repair-context panel for a structural rejection.
const COMMON_KEYS = [
  "experiments.experimentCreatedAttachFailed",
  "experiments.experimentCreatedUnattachedTitle",
  "experiments.experimentCreatedUnattachedBody",
  "experiments.openCreatedExperiment",
];

describe("dynamic command authoring locale coverage", () => {
  it.each(Object.entries(WORKBOOK))("%s workbook has every authoring UI key", (_locale, bundle) => {
    for (const key of WORKBOOK_KEYS) {
      expect(typeof resolve(bundle, key), key).toBe("string");
    }
  });

  it.each(Object.entries(WORKBOOK))(
    "%s workbook has a guidance string for every issue code + the generic fallback",
    (_locale, bundle) => {
      for (const code of DYNAMIC_COMMAND_ISSUE_CODES) {
        const key = dynamicCommandIssueKey(code);
        expect(typeof resolve(bundle, key), `${code} -> ${key}`).toBe("string");
      }
      expect(typeof resolve(bundle, dynamicCommandIssueKey("UNKNOWN_CODE"))).toBe("string");
    },
  );

  it.each(Object.entries(WORKBOOK))(
    "%s workbook has a source-type label for every type + the generic fallback",
    (_locale, bundle) => {
      for (const type of SOURCE_TYPES) {
        const key = sourceTypeLabelKey(type);
        expect(typeof resolve(bundle, key), `${type} -> ${key}`).toBe("string");
      }
    },
  );

  it.each(Object.entries(EXPERIMENTS))(
    "%s experiments has the attach/upgrade rejection keys",
    (_locale, bundle) => {
      for (const key of EXPERIMENTS_KEYS) {
        expect(typeof resolve(bundle, key), key).toBe("string");
      }
    },
  );

  it.each(Object.entries(COMMON))(
    "%s common has the new-experiment attach outcome keys",
    (_locale, bundle) => {
      for (const key of COMMON_KEYS) {
        expect(typeof resolve(bundle, key), key).toBe("string");
      }
    },
  );
});
