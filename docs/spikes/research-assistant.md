# Research assistant proof-of-concept handoff

This document records what the research-assistant spike proves, what remains, and what must happen before the work can move beyond a local proof of concept. It covers OJD-1887 through OJD-1899 against base commit `8be3155b38771db95288f87081e44800dede7ebb` and the working tree reviewed on 21 September 2026.

The pull request should use `Contributes to`, not `Closes`, for every ticket. The code is broad, but most release acceptance criteria are still partial.

The existing Linear project and ticket bodies remain the source of truth. This handoff adds evidence and names gaps; it does not replace their original goals or acceptance criteria. Any refinement below that is not already accepted in Linear should be proposed as follow-up work rather than silently becoming a new requirement.

## What the spike proves

- The web panel can call Nest, which calls a bounded Python agent and the selected Databricks Luna endpoint.
- Nest keeps the signed-in researcher as the authorization principal. The model service receives messages and typed tool results, not the browser session or direct platform access.
- Platform writes use persisted drafts. The researcher can edit, discard or confirm them, and the backend rechecks permissions at confirmation.
- Token reservations are atomic. Complete turns reconcile measured usage, while incomplete accounting keeps the conservative reservation.
- The generated evaluation contract comes from the production prompt and tools. CI builds the backend, checks contract hash `53ebb8fea65d189df9a8d747b73bfbc93000b3f5a81f7f8b5aef81cfa7665d61`, and runs locked provider-free tests.
- Model compatibility settings and their hash stay bound to encrypted continuation state. A mixed-profile resume fails before inference.
- Documentation links, corpus detail links and confirmed visualization links resolve to their intended routes. Legacy non-HTTP corpus URLs become `null` for authenticated and public responses.
- Browser work confirmed a substantive protocol, a corrected macro and a five-cell workbook. The macro passed two valid and six invalid sandbox cases before confirmation.
- A fresh Luna run confirmed the collection through the declared capture path and attached the resulting workbook through the canonical use case. Experiment `84cab6e4-db03-487a-bf68-c7afcff27b65` shows version 1, five blocks, two required questions, sun/shade choices and the protocol and macro source in Design.
- The literature corpus currently contains 21 papers and 255 generated reading-copy pages with a portable manifest and build path under `apps/assistant-agent/corpus`.

Provider-free Python tests pass 49 cases. Focused legacy source-link tests pass 22 cases. These results do not prove live provider availability, backend permissions, scientific quality or a production deployment.

## Built versus defined

| Area                                             | Built in the spike                                                                                                                                                                                                                    | Original acceptance still open or proposed follow-up                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Model and runtime, OJD-1887                      | Luna works locally through the Python continuation service. The ADR records runtime ownership and deployment gates.                                                                                                                   | Compare eligible endpoints on one current 20-prompt suite. Record processing location, retention, priced cost, alerts, rollback and the embedding endpoint.                                |
| Page assistant, OJD-1888                         | Pinned panel, Mod+J, page context, threads, ratings, quotas and permission-scoped tools. The 1280-pixel repair has focused test coverage.                                                                                             | Use one cohort identity across web, backend and private knowledge. Add claim-level citations, failed-turn history, accurate error copy and true streaming or explicitly staged delivery.   |
| Search and docs, OJD-1889                        | Permission-scoped entity search and lexical docs retrieval. Safe source URLs work across local and deployed docs origins.                                                                                                             | Add semantic recall, freshness guarantees and evidence that citations support specific claims rather than every retrieval hit.                                                             |
| Data questions, OJD-1890                         | Bounded typed queries and confirmed visualization creation.                                                                                                                                                                           | Add data-description, chart rendering, long-query progress, dashboard reads and environment-aware access to approved real examples.                                                        |
| Confirmed setup, OJD-1891                        | Draft edit, discard and confirm flows call existing creation use cases. Protocol, macro and workbook creation have browser evidence. A fresh collection confirmation attached the workbook through the canonical experiment use case. | Make recovery available after a refetch, keep recovery checks from affecting non-attachment cases, finish the safe organization picker and make create finalization crash-safe.            |
| Starter reuse and curation, OJD-1892 to OJD-1893 | Gallery, filters, reuse counts, private copies, collections and operator-guarded curation exist.                                                                                                                                      | Persist lineage on every entity type, show it on entity pages, add collection reorder UI and remove the 500-row in-memory discovery ceiling.                                               |
| Usage and cost, OJD-1894                         | Postgres usage events, quotas, atomic reservations, operator totals and editable token budgets exist. The temporary 200,000-token local budget was restored to the 100,000-token default.                                             | Add the PostHog events and dashboard, priced provider reconciliation, currency alerts and a tested inference kill switch.                                                                  |
| Genie, OJD-1895                                  | A fenced client exists and reports unavailable.                                                                                                                                                                                       | Prove isolation outside prompts and run the 20-question priced study before deciding whether to adopt, defer or drop it.                                                                   |
| Public endpoint, OJD-1896                        | Anonymous JSON-RPC search returns docs and separately approved corpus chunks.                                                                                                                                                         | Add approved public entity reads, application throttling and the developer connection guide, or keep the endpoint disabled outside local development.                                      |
| Literature, OJD-1897 to OJD-1898                 | Rights, parse review, admission, removal and separate external-public status exist. Reading copies carry page-level provenance.                                                                                                       | Replace organization-admin self-approval with an appointed curator, move rights state to durable storage and remove every governed copy when rights change. DOI and bioRxiv import remain. |
| Document to draft, OJD-1899                      | Bounded upload and Databricks parsing expose pages, tables and confidence.                                                                                                                                                            | Attach documents in chat, propose a starter through the normal draft flow, verify all promised file types and govern local and remote deletion.                                            |

The earlier experiment `38f1622e...` remains a useful regression fixture: Overview shows a workbook while Design reports none because `workbookVersionId` is null. A new experiment, `84cab6e4-db03-487a-bf68-c7afcff27b65`, proves that the canonical attachment path now succeeds. Authoring is still partial because recovery is unavailable after a refetch and recovery checks currently affect cases that do not attach a workbook. Keep the broken fixture unchanged and cover those two recovery boundaries before treating the flow as complete.

## Biggest findings

### Corpus authority crosses the organization boundary

An organization owner or administrator can act as a global corpus curator, approve the same work for internal and anonymous use, and self-approve every gate. Global publication needs a named platform curator. External publication must remain a separate recorded decision.

### Rights and document state are not durable

Corpus records, rights decisions and private-document metadata live in one process-local JSON file. Replicas can diverge, concurrent state changes can overwrite each other, and removal can be reversed by a stale save. Shared deployment needs transactional storage and terminal removal state.

### Deletion does not cover the Databricks copy

Private-document deletion removes the local record and file but leaves the uploaded volume object. Corpus removal also leaves parsed and remote copies. A deletion response cannot claim completion until every governed copy has a recorded disposition.

### Feature access is inconsistent

The web, browser analytics and backend use different feature identities. Private knowledge routes bypass the assistant cohort. The anonymous endpoint has no application rate limit and does not inherit the researcher's cohort by design.

### Confirmation still has a crash boundary

The state machine prevents duplicate confirmation, but a process exit after entity creation and before draft finalization can strand the created entity. Use the draft ID as an idempotency key or commit creation and finalization through one transaction or outbox.

### Real research context is incomplete

The assistant cannot describe experiment tables, read dashboards or saved visualization settings, or distinguish local, dev and production entity identities. A production UUID pasted into local chat is not a usable knowledge path. Cross-environment reads must use a researcher-scoped or explicitly public identity, never a root or operator key.

## Merge gates

The proof-of-concept PR can merge only when dangerous shared routes are fixed or demonstrably disabled outside an isolated local environment.

1. Replace organization-admin corpus publication with explicit platform curator authority and separate external approval.
2. Apply one feature identity and access policy to the web, core assistant and private knowledge routes. Restrict environment overrides to development.
3. Disable or throttle the anonymous endpoint before shared traffic can reach it.
4. Finish the attachment recovery follow-ups: expose recorded-created-ID recovery after refetch and ensure its checks do not affect non-attachment cases.
5. Keep corpus mutation and document upload local-only until durable state and governed deletion exist.
6. Record final focused checks and browser evidence in the PR. Keep every Linear relation as `Contributes to`.

## Release gates

1. Move knowledge metadata and rights decisions to transactional durable storage with conditional state transitions.
2. Delete or tombstone local, indexed and Databricks copies with retries and an auditable result.
3. Make entity creation crash-safe and idempotent across every supported draft kind.
4. Finish claim citations, failed-turn history, error translations and the documented delivery model.
5. Add data description, dashboard and visualization reads, plus environment-aware approved real examples.
6. Persist and display starter lineage on entity pages and remove the discovery ceiling.
7. Complete semantic retrieval and its freshness checks.
8. Complete the model comparison and priced cost controls below.
9. Run each ticket's testing criteria on dev and obtain product and technical acceptance.

## Model onboarding and evaluation

Adding a model is a controlled comparison, not a name change.

1. Verify that the exact endpoint is callable in the permitted workspace. A Unity Catalog entry does not prove serving access.
2. Add the endpoint to `ASSISTANT_ALLOWED_MODELS`. This is the access control.
3. Add a compatibility profile only when the endpoint needs different reasoning or output limits. Profiles cannot enable an endpoint or increase the backend allowance.
4. Set the backend model to the exact allowlisted endpoint. Do not add automatic fallback.
5. Build the backend and run `pnpm assistant:check-contract`. Record the contract hash, code revision, model name and state-bound profile hash.
6. Run the same versioned 20-prompt suite for every candidate. Do not compare runs after changing fixtures, prompt or tools without starting a new series.
7. Run separate authenticated browser checks for permissions, confirmation and real persistence. Synthetic tool fixtures do not prove those boundaries.

The comparison report should include:

- success by scenario, including tool selection, valid arguments, refusals, citation support and draft completeness;
- latency per turn and model step, with median and 95th percentile;
- input and output tokens, tool rounds, failures and incomplete accounting;
- dated endpoint price units, calculated cost per successful task and reconciliation with provider billing;
- processing region, cross-region behavior, retention terms and the exact model terms;
- the contract hash, profile hash, code revision and any semantic-judge model used.

Promotion needs an operator-controlled cohort, a rollback endpoint, currency alerts and a tested kill switch. The existing daily token quota limits application use but does not prove currency spend. Prompt text stays out of aggregate product analytics.

## Corpus licence boundaries

Public visibility in openJII is not permission to ingest, quote, redistribute or train on a work. Record each permission separately.

- Acquisition records where the file or identifier came from and which version was fetched.
- Parsing permission covers the stored file, extracted text, tables and generated reading copy.
- Assistant-use permission covers retrieval and sending excerpts to the selected model under the deployment's processing terms.
- Display permission covers citations, snippets and links shown to signed-in researchers.
- External-public permission covers anonymous endpoint responses and requires a separate approval.
- Training or skill-extraction permission is a later decision. Conversation history and retrieved excerpts are not automatically training data.

Missing licence information stays unknown and blocks admission. A curator must inspect parse output before approval. Reading copies omit figures and tables unless the licence and build explicitly allow them; omitted numerical material cannot support an answer. Preprints keep their source version and status. bioRxiv and Europe PMC discovery may propose an import but cannot admit it automatically.

Removal must stop new retrieval promptly and track every derived copy, including local files, indexes, reading copies, traces, evaluation datasets and Databricks volume objects. Do not promise automatic unlearning from an already trained model.

## Missing documentation

The user guide and provider ADR now describe post-turn text delivery, model compatibility, hardware caveats and the local proof accurately. The following documents still need owners before release:

- a model operations runbook covering endpoint onboarding, rollout, rollback, billing reconciliation, alerts and the kill switch;
- the completed 20-prompt comparison report with contract and profile identities;
- a public endpoint connection guide with tool list, rate policy and data-use limits;
- a corpus curator guide covering roles, rights fields, admission, external approval, replacement and removal;
- a retention and deletion policy for conversations, uploads, traces, evaluation exports and future training datasets;
- an environment-identity design for local, dev and production sources;
- a data and dashboard tool guide that states query limits and unsupported operations.

## Browser and video evidence

The staged evidence includes replay/state clips and a separate `assistant-confirm-collection.webm` capture of the fresh declared-capture confirmation. The replay clips show saved research and results; they do not prove the creation actions. The corrected corpus clip was recorded after live data loaded. Describe each clip only by the actions actually visible in it.

Video publication remains pending human frame review for private data, credentials, unrelated tabs and misleading transient states. The new confirmation clip proves canonical attachment for experiment `84cab6e4-db03-487a-bf68-c7afcff27b65`; it does not close the refetch and non-attachment recovery follow-ups.
