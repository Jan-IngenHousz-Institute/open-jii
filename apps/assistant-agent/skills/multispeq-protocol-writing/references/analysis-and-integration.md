# Analysis and openJII integration

## Read the pair before drafting

Use `search_entities` to find the requested protocol or workbook. Use `get_entity` for the full code/cells. Inspect the associated macro when its identifier is available. A search hit or title is not enough to confirm phase structure or compatibility. A tool refusal must remain a refusal; never reconstruct a private resource from an operator catalogue.

For a selected baseline, retain its actual source ID in the draft source metadata when supported. Keep exact platform IDs out of generic instructions and examples. UUIDs from another environment are not portable references.

## Map raw data to quantities

Create an analysis contract with these columns:

| Block label and occurrence | Response path | Channel order | Required samples/window | Output and unit | Invalid input behavior |
| -------------------------- | ------------- | ------------- | ----------------------- | --------------- | ---------------------- |

The transport may return nested `sample`, `set`, or platform-normalized `sample_raw` structures. Determine the actual shape from a supplied raw fixture or a readable paired implementation. Do not guess that every macro receives a top-level `data_raw` array.

Multi-detector ordering depends on the protocol, firmware and response format. The common phase-local interleaved layout must be established from the paired raw fixture or version-matched implementation before separating channels. A recorded RIDES 2.1 capture on firmware 2.311 is a counterexample: its 620-value PAM trace has grouped fluorescence values at [0:310] and PSI values at [310:620]. That single capture is not a universal firmware rule. Do not apply an even/odd split or infer channel layout from a protocol name or signal magnitude alone. Preserve which values were measured during illumination, darkness, settling and saturation. A fit must use the correct physical time axis, not just array indices.

Block labels are part of the contract. Repeats can yield multiple blocks with the same label. In the current Python helper, `GetProtocolByLabel(label, json_data, array=False)` searches `json_data["set"]`: no matches returns `None`, one match returns that mapping, and multiple matches return a list. With `array=True`, even one match is a list, but no matches still returns `None`. Use the explicit array mode and handle missing results when processing a light series. `GetIndexByLabel` has the same single-versus-many convention for indices; `GetLabelLookup` maps labels to index lists. These helpers do not discover an outer `sample` or `sample_raw` wrapper for you.

Preserve raw data. openJII contains a historical RIDES repair because a macro de-interleaved `PAM.data_raw` in place, and a later execution applied the transformation again. Source: `apps/data/src/lib/data_repair/data_repair/repairs/_2026_04_rides_inplace.py`. Work on copies and test the analysis twice against unchanged input. Do not apply that repair to new traces merely because their protocol has RIDES in its name.

## The current macro runtime

The assistant's `draft_entity` code schema is the authoritative current runtime instruction. New assistant-authored macros use `language: "python"`, readable source, and `codeEncoding: "utf8"`. Confirmation encodes once for storage. Existing stored JavaScript, R, and base64 macros are legacy resources; do not reinterpret their encoding by guessing.

The macro receives the direct normalized measurement as `json`, not necessarily the original transport envelope. The platform unwraps `{sample: object}` or `{sample: [first, ...]}` once; additional sample entries are discarded with a warning. A root array remains an array. Do not add `json["sample"][0]` merely because an archived transport response used that shape, and do not recursively unwrap nested samples. Inspect the normalized inner `set`/`data_raw` contract. The executable contract lives in `packages/api/fixtures/macro-input-normalization.json`.

The Python source is a function body, not a script or an unused `main()` definition. Return a dictionary at top level, or mutate the provided output dictionary's keys. Merely defining a helper or rebinding `output` can finish with empty results. Imports and ordinary built-ins are restricted. The supplied `np`, `pd`, `scipy`, `json_module`, and helper names have a specific runtime contract. Context mappings are read-only; use lookup methods rather than requiring a concrete `dict`. Lists can be frozen into tuples. Each row has a one-second execution limit.

You cannot execute a macro with the current assistant tool set. Give the researcher a sandbox test plan with expected outputs, or report evidence from an actual tool if an execution capability is later provided. A successful draft is evidence of stored content validation, not successful code execution.

## Reference calculation and failure cases

For the JII Phi2 baseline, preserve the particular Fs and Fm′ windows or revise them with the acquisition change. Validate the minimum trace length, channel count, finite numbers, and nonzero denominator. Report invalid or clipped traces with a useful reason instead of silently substituting zero.

A useful synthetic check is Fs=100, Fm′=400, giving Phi2=0.75. Also test a truncated trace, missing PAR, a zero Fm′, mixed-channel input, and multiple set occurrences. The test needs expected scientific outputs and input immutability, not only success status. Synthetic data is not a scientific calibration.

## Build the collection workflow

The protocol defines physical acquisition. Workbook questions define sample and treatment metadata; Markdown cells explain handling and limitations; macro cells perform analysis. The experiment description documents the hypothesis, design, sampling, replication, and intended QC. Written prose does not create data columns.

If creating a new pair, draft and confirm the protocol and macro separately. Retrieve their saved IDs before drafting workbook cells. Use real readable references and the current workbook cell schema; never embed invented UUIDs. The current protocol-cell version field uses 1, but it is not proof of an immutable experiment workbook snapshot.

When an experiment references a workbook, the platform's canonical attach path publishes or reuses an immutable workbook version and materializes its collection flow. The researcher should inspect experiment Design after confirmation. A bare workbook name or pointer is not evidence the collection flow is installed.

Do not promise permanent privacy. Drafts begin private, but experiments follow the platform's embargo and scheduled-publication policy. Confirmation checks source and destination permissions again.

## Draft response

Explain the validated returned payload, not the intended payload. Include the source baseline, changed phases, expected outputs, and unresolved firmware or calibration facts. Say 'draft prepared for review' until the platform reports actual confirmation. For an environmental-only draft, say it measures ambient PAR, and explicitly identify fluorescence as outside that recipe.
