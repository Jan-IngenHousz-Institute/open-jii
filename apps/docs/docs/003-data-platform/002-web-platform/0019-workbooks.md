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
- **Questions** support several answer types. For multiple choice you can add options one at a
  time, or use **Bulk Add** to paste a whole spreadsheet column (one option per line). Each option
  is capped at 64 characters, and large sets (over 25 options) collapse to a compact summary so a
  column of thousands of plot IDs never freezes the editor.

## Versioning & editing in place

From an experiment's **Design** tab you attach a workbook (or create one). Attaching publishes the
workbook's current cells as a new version and pins the experiment to it.

<video controls width="100%" preload="metadata">
  <source src="/img/workbooks/versioning-demo.webm" type="video/webm" />
  Your browser does not support embedded video.
</video>

- The Design tab renders the **pinned version's snapshot read-only**, so you always see exactly what
  the experiment is collecting — independent of later edits to the underlying protocols, macros or
  the workbook draft.
- The workbook owner can toggle between **View pinned version** (the snapshot) and **Edit workbook**
  (the live, autosaving draft) without leaving the experiment.
- When the draft has changes the experiment hasn't adopted yet, an **update-available** banner lets
  an experiment admin publish a new version and upgrade the experiment to it.
