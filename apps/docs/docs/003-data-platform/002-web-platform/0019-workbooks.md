# Workbooks

A **workbook** is the data-collection design for an experiment: an ordered list of **cells** that
together define the measurement flow the mobile app and data pipeline follow.

| Cell         | What it does                                                                     |
| ------------ | -------------------------------------------------------------------------------- |
| **Protocol** | References a saved protocol (a measurement recipe); its code is editable inline. |
| **Macro**    | Post-processing code (JavaScript, Python or R) that runs against the output.     |
| **Question** | Captures field input — yes/no, text, number, or multiple-choice.                 |
| **Branch**   | Conditional paths (e.g. re-measure if a value is out of range).                  |
| **Markdown** | Free-text notes and documentation between cells.                                 |
| **Output**   | Auto-inserted by executable cells to show results.                               |

Workbooks are **versioned**. Attaching a workbook to an experiment pins an _immutable published
version_, so editing the workbook afterwards never silently changes what a running experiment
collects — until you explicitly publish a new version and upgrade.

The walkthrough below shows the recent authoring and editing improvements end to end — the cell
sidebar, the question editor, the searchable workbook picker, and renaming a linked workbook in
place:

<video controls width="100%" poster="/img/workbooks/ux-sidebar.png" preload="metadata">
  <source src="/img/workbooks/workbook-ux-improvements.webm" type="video/webm" />
  Your browser does not support embedded video — see the screenshots below.
</video>

## Authoring a workbook

Create a workbook from the **Workbooks** list; it opens straight into the editor and autosaves as
you work. Add cells from the empty-workbook tray or the **+** between cells.

The walkthrough below adds a protocol, a macro and a multiple-choice question:

<video controls width="100%" preload="metadata">
  <source src="/img/workbooks/workbook-demo.webm" type="video/webm" />
  Your browser does not support embedded video.
</video>

- **Protocols & macros** are added through a **searchable picker** — type to filter the list, pick
  an existing protocol/macro, or create a new one inline. A protocol cell shows the measurement
  code; a macro cell shows its script (with a language switcher) and runs against the output.
- **Questions** support several answer types. The editor puts a clear, **required Question text**
  field front-and-centre — distinct from the cell's _name_ (the data-column key shown in your
  dataset). For multiple choice you can add options one at a time, or use **Bulk Add** to paste a
  whole spreadsheet column (one option per line). Each option is capped at 64 characters — labelled
  inline with the reason (so the choices stay readable as buttons in the mobile app) — and large
  sets (over 25 options) collapse to a compact summary so a column of thousands of plot IDs never
  freezes the editor.

  ![Question cell editor with a prominent "Question text" field and a multiple-choice list that explains the per-option character limit.](/img/workbooks/ux-question.png)

- The **cell sidebar** lists every cell by its own name, with a per-type icon and colour rather than
  a repeated cell type, so a flow full of questions is easy to scan. Drag a row to reorder, click one
  to jump to it, and required questions are flagged with an asterisk.

  ![The workbook cell sidebar listing each cell by name with per-type icons and colours.](/img/workbooks/ux-sidebar.png)

- **Branches** route the flow based on data collected so far (e.g. re-measure when a value is out of
  range):
  - **Paths** — a branch holds one or more paths, checked top to bottom; the flow takes the first
    path whose conditions all pass. If none match, it continues to the next cell.
  - **Conditions** — each compares a value from an earlier cell (a question's answer, or a field
    from a protocol/macro output) against a value you type, using `=`, `!=`, `>`, `<`, `>=` or `<=`
    (numeric when both sides are numbers, otherwise text). Multiple conditions on a path are combined
    with **AND**, and a value that can't be read yet safely counts as no-match.
  - **Jump** — a matching path can jump to another cell: forward to skip ahead, or back to repeat a
    step (loop-backs are protected against running forever); otherwise the flow continues to the next
    cell.
  - **Mobile** — on the [mobile app](../002-mobile-app.md) branches are evaluated automatically
    on-device, so they work offline.

## Running cells on multiple devices

Connect several sensors of the same type from the workbook toolbar (**Connect**, then **Add
device**) and executable cells fan out: protocol and command cells run on **every connected device
in parallel**, output cells show one result block per device, and macro cells post-process **each
device's measurement individually**. One failing sensor never blocks the others — its error is
listed per device and the cell can simply be rerun.

<video controls width="100%" preload="metadata">
  <source src="/img/workbooks/multi-device-demo.webm" type="video/webm" />
  Your browser does not support embedded video.
</video>

For the full picture — including the mobile app's USB-hub flow, the `bundle_id` correlation fields
in the data pipeline, and the mock devices used in the video above — see
[Multi-device measurements](../004-multi-device-measurements.md).

## Versioning & editing in place

From an experiment's **Design** tab you attach a workbook (or create one). Attaching publishes the
workbook's current cells as a new version and pins the experiment to it. Both here and when first
creating an experiment, the workbook is chosen from a **searchable picker** — type to filter instead
of scrolling the whole list.

![The searchable workbook picker on the new-experiment form, filtered as the user types.](/img/workbooks/ux-picker.png)

<video controls width="100%" preload="metadata">
  <source src="/img/workbooks/versioning-demo.webm" type="video/webm" />
  Your browser does not support embedded video.
</video>

- Anyone viewing sees the **pinned version's snapshot read-only**, so you always see exactly what the
  experiment is collecting — independent of later edits to the underlying protocols, macros or the
  workbook draft.
- The **workbook owner edits the live draft inline** on the Design tab; it autosaves, and each save
  re-pins the experiment to the latest version automatically — no separate publish step.
- You can **rename the linked workbook in place** from the Design tab (owner only), instead of going
  back to the Workbooks list to do it.

  ![Renaming the linked workbook in place from the experiment's Design tab.](/img/workbooks/ux-rename.png)

- When a newer published version exists, an **update-available** banner lets an experiment admin
  upgrade the experiment to it.
