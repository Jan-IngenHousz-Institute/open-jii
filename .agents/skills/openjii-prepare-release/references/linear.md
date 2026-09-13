# Linear release update

Read `docs/agents/issue-tracker.md` and `CONTRIBUTING.md#pull-request-and-release-metadata`. Prefer
the connected Linear MCP for a single update. For API fallback use `LINEAR_API_KEY` from root `.env`
or the shell; a personal key goes in `Authorization` without `Bearer`. OAuth tokens use `Bearer`.

Ask whether the destination is a **project update** or an **issue comment**, and resolve its name,
URL and UUID before posting. Draft locally when the choice or access is missing. A PR's OJD relation
does not establish the destination project. Never create a new issue merely to hold the release.

Draft the update with the release date/candidate, intended audience, user-visible changes, blockers,
and links to the branch, PRs, notes and reviewed media. Say "prepared" until deployment is verified.
Do not change issue states or duplicate `linear-release-action`: production workflows own release
sync/complete and PR labeling. The optional update is a human-readable communication.

## Direct API fallback

The [official Linear API guide](https://linear.app/developers/graphql) documents authentication,
introspection and GraphQL errors. Use the current schema for `ProjectUpdateCreateInput` or
`CommentCreateInput` and the destination's update/comment connection. Read-only GraphQL uses POST
too; classify by query versus mutation, not by HTTP method.

Resolve and inspect the project or issue first. Stage a request JSON using variables, for example:

```json
{
  "query": "mutation ReleaseUpdate($input: ProjectUpdateCreateInput!) { projectUpdateCreate(input: $input) { success projectUpdate { id body } } }",
  "variables": {
    "input": {
      "projectId": "<verified-project-uuid>",
      "body": "<reviewed Markdown release update>"
    }
  }
}
```

For an issue comment the corresponding operation is
`commentCreate(input: $input) { success comment { id body } }` with `CommentCreateInput` containing
`issueId` and `body`. Follow any additional required fields in the current schema. Do not include
an invented project health/status merely to satisfy a guessed schema.

After posting is explicitly selected and the concrete destination and copy are reviewed, an agent
can submit the staged file with a small local Node script. Node 24 is required by this repo:

```js
// Save as .release-prep/<release-id>/post-linear.mjs. Do not execute for a mock or draft-only choice.
import { readFile } from "node:fs/promises";

const token = process.env.LINEAR_API_KEY;
if (!token) throw new Error("Missing LINEAR_API_KEY");
const payload = JSON.parse(await readFile(process.argv[2], "utf8"));
const response = await fetch("https://api.linear.app/graphql", {
  method: "POST",
  redirect: "error",
  signal: AbortSignal.timeout(15000),
  headers: { Authorization: token, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
if (!response.ok) throw new Error(`Linear returned ${response.status}; inspect before retrying`);
const result = await response.json();
if (result.errors?.length) throw new Error("Linear GraphQL error; inspect before retrying");
const mutation = result.data?.projectUpdateCreate ?? result.data?.commentCreate;
if (!mutation?.success) throw new Error("Linear did not confirm success; inspect before retrying");
console.log(JSON.stringify(mutation, null, 2));
```

Run with `node --env-file=.env .release-prep/<release-id>/post-linear.mjs <request-json-path>` from
the root if `.env` exists; omit `--env-file` for shell-only credentials. Save the returned ID and
read the object back, verifying destination and full body, then record its URL.

Creation is not idempotent. Before an initial post and especially after an ambiguous timeout, read
the destination's recent updates/comments with pagination back to the release's preparation time.
Compare exact body or SHA-256 of the body. Reuse a matching item and record its ID. If the outcome
cannot be established, stop that post instead of blindly repeating a mutation. Updating an existing
post's copy is a separate explicit edit. A mock writes the JSON request and records "not sent".
