# Numeric question answers

Approved Number answers are stored as finite DOUBLE values inside `questions_data`
in the existing raw and macro gold tables. The platform and exports apply the same
finite-number rule when reading older rows. Categorical values such as `007` stay
text unless their exact experiment/key is approved as Number.

Gold also keeps `questions_original_data`, the sanitized question object before
numeric conversion. This doubles the stored question object, but preserves exact
lexical answers for metadata identifiers and recovery, including repeated row IDs.
The enriched views use the original for metadata matching and omit the recovery
column from their output. Macro `macro_context`, bronze and silver remain lexical.
The serving feed omits the recovery column and emits the typed `questions_data`.

`experiment_question_types` in Postgres separates a durable `declared_class` guard
from the `active` numeric decision. Pins, restores, imports and flow edits record
question names under the experiment row lock. Deleting a question does not erase
its declaration. A Number/text change needs a new name. New platform experiments
track their complete history and activate Number keys on first pin. Existing
experiments and transfers need a complete historical review before activation.

Mobile uploads every question in the flow. Unanswered, cleared and skipped-branch
questions have JSON null answers. All new gold writes normalize blank answers to
null for every kind, including unapproved text keys. Historical blanks are changed
only in experiments selected for the manual release rewrite; other stored history
is untouched.

## Pipeline behavior

Gold fails closed when the signed backend lookup is unavailable or incomplete.
It batches at most 500 UUIDs, bounds request time/retries and never treats lookup
failure as an empty registry. The full-inventory lookup shares a 30-second budget
across all chunks. A slow or large inventory can time out; check backend health
before retrying.

The `valid_numeric_question_answers` DLT expectation counts invalid approved live
values. Those values become JSON null while the original remains available.
Pipeline failure alerts must cover the lookup dependency and failed expectation
records.

Macro and both schema readers use `skipChangeCommits`. Raw gold has
`pipelines.reset.allowed=false` because a raw reset could replay historical macro
execution. A deliberate raw rebuild needs a reviewed property change and
coordinated downstream checkpoints, schema summaries and serving reconciliation.

Historical guard seeding, numeric activation, stored-value rewrites and recovery
are manual release operations documented in the PR description.

## Numeric and verification limits

DOUBLE uses IEEE-754 precision. Signs, surrounding ASCII whitespace, `.5`, `5.`,
leading zeros and exponent notation are accepted. NaN, infinity, overflow, Java float
suffixes, hex and malformed strings are invalid. Extreme underflow may become zero.
Mobile validates new input and normalizes decimal commas; old queued invalid input
is observable through the expectation above.

Local Spark and isolated Postgres tests cover conversion, Arrow/HMAC lookup,
metadata joins and guard behavior. PR evidence separately records disposable
Databricks streaming-table and checkpoint probes. Production classification,
serving-store parity and the release window remain maintainer work. No shared
historical activation or rewrite has been run.
