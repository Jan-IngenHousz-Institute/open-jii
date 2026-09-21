---
name: prepare-workbook
description: Prepare or adapt an openJII field workbook with questions, protocols, macros, and device-dependent steps.
metadata:
  status: candidate
  version: "0.1.0"
---

1. Identify the field objective, device family, inputs to record, and expected measurement outputs. Read an accessible workbook or starter before adapting it.
2. Check the current workbook cell contract. Order cells so questions and measurements precede macros that consume them. Consult the macro guide for the current `json`, `ctx`, and `ctx.$device` conventions rather than assuming every prior value is the latest measurement.
3. Preserve canonical cell references and device scope. A connected-device branch must use fields actually supplied by the host. If a referenced protocol or macro needs editing, propose the necessary copy or fork instead of assuming ownership of the original.
4. Return a workbook draft for review through `draft_entity`. Clearly separate what the draft creates from follow-up operations such as attaching it to an experiment or publishing a version.
5. Verify the intended protocol-to-macro flow on a representative device or an explicitly labelled supported simulator. Success means observed measurements and derived values, not just successfully saved cell JSON. If the assistant lacks a runner, report runtime verification as pending.
6. For an existing experiment, preserve its pinned workbook version until the researcher deliberately upgrades it after reviewing the changes. Record a version change as a methods change.

Consult `apps/docs/content/guide/experiments/workbooks.mdx`, `apps/docs/content/guide/devices-protocols/writing-macros.mdx`, and the current workbook contract. The historical promo workflow used synthetic measurements and an injected serial simulator; those are demo evidence, not a production device setup procedure.
