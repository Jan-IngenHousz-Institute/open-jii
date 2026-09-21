---
name: prepare-experiment
description: Prepare an openJII experiment draft from a research objective or an existing accessible starter.
metadata:
  status: candidate
  version: "0.1.0"
---

1. Establish the measurement objective, destination organization, and whether an existing workbook should define the field workflow. Ask for a missing choice only when it changes the proposed experiment.
2. Search visible experiments and workbooks before inventing a replacement. Read the selected source through the authenticated entity tool. Preserve its source reference when deriving a draft.
3. Consult the current create-experiment contract for accepted fields. The assistant's create path defaults to private; the ordinary wizard's public default is not the assistant default. Make visibility and any embargo explicit in the review.
4. Prepare the experiment with `draft_entity`. Describe the selected workbook and unresolved field-method decisions. A draft is complete when the researcher can review its actual values and source.
5. Report creation only after confirmation returns the created resource. Attaching or upgrading a workbook requires its own supported operation and a verified pinned version; an experiment draft alone does not establish that the complete field workflow is ready.

Consult `apps/docs/content/guide/experiments/creating.mdx` for the wizard, `apps/docs/content/guide/experiments/workbooks.mdx` for pinning, and `packages/api/src/domains/experiment/experiment.schema.ts` for accepted create fields. These are repository reference paths, not instructions to access arbitrary files or credentials.
