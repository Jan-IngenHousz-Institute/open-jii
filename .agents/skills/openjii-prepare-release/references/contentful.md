# Contentful release notes and mobile gate

Use root `.env` with `CONTENTFUL_SPACE_ID`, `CONTENTFUL_SPACE_ENVIRONMENT`, and
`CONTENTFUL_MANAGEMENT_TOKEN` or the existing `CMA` alias. Delivery and preview tokens cannot write.
The environment is mandatory. Verify it matches the app's configuration before any live write.
The helper uses the standard Contentful region; EU-resident spaces need their regional CMA endpoint
and should use the documented API route after verifying residency.

## Notes

```sh
pnpm --filter @repo/devkit release:cms preflight
pnpm --filter @repo/devkit release:cms inspect
```

Inspect returns the live `componentReleaseNote` model, locales, and the first 100 entries with total.
Paginate CMA reads if total exceeds the returned count. Confirm required fields and allowed values
from this model. Generated GraphQL fields are consumer types, not the complete management schema.
Keep inspection output in the local packet when it includes unpublished content.

Write a JSON file with this shape. Replace the example copy and date with verified release facts.
Include any additional required fields, such as `internalName`, reported by the live model.

```json
{
  "locale": "en-US",
  "fields": {
    "slug": "release-2026-09-13",
    "title": "A clearer view of your experiments",
    "summary": "Find experiment activity and data more easily.",
    "body": {
      "nodeType": "document",
      "data": {},
      "content": [
        {
          "nodeType": "paragraph",
          "data": {},
          "content": [
            {
              "nodeType": "text",
              "value": "Replace with verified release copy.",
              "marks": [],
              "data": {}
            }
          ]
        }
      ]
    },
    "surfaces": "web",
    "publishedAt": "2026-09-13T12:00:00Z",
    "active": true
  }
}
```

The file is a patch to one locale. Existing fields, other locales and metadata survive. Nonlocalized
fields use the environment's default locale. `surfaces` is one string: `web`, `mobile`, or `both`.
`body` is Contentful rich text, not Markdown. Resolve category values and CTA/SEO/media links from
the live model. An omitted field stays unchanged; clearing a field must be intentional.

```sh
pnpm --filter @repo/devkit release:cms draft --file /absolute/path/to/note.json --dry-run
pnpm --filter @repo/devkit release:cms draft --file /absolute/path/to/note.json
```

Dry run is offline: no credentials, live schema checks, reads or writes. It previews the localized
input, not the full merged entry. A live draft reads schema/locales, finds the slug, rejects duplicate
slugs, and creates an unpublished entry with a stable ID. It never publishes. Identical reruns are
no-ops. To change an existing entry, inspect it, review its current contents, then supply its version:

```sh
pnpm --filter @repo/devkit release:cms inspect --entry-id <id>
pnpm --filter @repo/devkit release:cms draft --file /absolute/path/to/note.json --entry-id <id> --version <reviewed-version>
```

A timeout or conflict is not permission to overwrite. Inspect the entry before retrying. Record its
ID and returned version. Prefer a stable slug for the release across reruns and locales.

After the intended production tracks are verified and the copy/media are reviewed, hand off this
command with the exact draft version. Running it publishes the note; preparation does not run it.

```sh
pnpm --filter @repo/devkit release:cms publish --entry-id <id> --version <reviewed-version>
```

Published `active:true` notes with `publishedAt <= now` appear in the public changelog and matching
in-app feeds. A future date is a timer, not a deployment check. Keep staged notes unpublished.
The single-note slug query does not apply the collection's date cutoff, so a future date is not a
private preview mechanism. Verify the live detail page and intended feed after publication.

## Media links

Capture and review using [the media recipe](media.md) first. Reuse an existing approved Contentful
asset when appropriate. For a new file, use the CMA upload/asset operations from the
[official asset documentation](https://www.contentful.com/developers/docs/references/content-management-api/assets/)
and [uploads](https://www.contentful.com/developers/docs/references/content-management-api/uploads/):

1. POST the reviewed file bytes to the upload API for the selected space. Record the upload ID.
2. PUT a deterministic asset ID under the selected environment with localized `title`, `description`
   and `file: {contentType, fileName, uploadFrom: {sys: {type: "Link", linkType: "Upload", id}}}`.
3. PUT `assets/<id>/files/<locale>/process` with `X-Contentful-Version`. Poll GET until the processed
   file URL exists, with a bounded deadline. A processing failure blocks only that asset.
4. Publish the reviewed asset with its current version only when authorized. Publishing an asset
   makes its URL accessible even if the release note remains a draft.
5. Link it using `{ "sys": { "type": "Link", "linkType": "Asset", "id": "<asset-id>" } }`
   in the note's `media` field, if its model accepts that asset type.

Before retrying upload/create, look up the recorded IDs. For body embeds inspect
`packages/cms/src/lib/graphql/richImageFields.graphql` and the release-note renderers. Detail pages
expand embedded `componentRichImage` entries; list feeds do not fetch all those links. Use only media
formats supported by the target web/mobile renderer, and preview both if `surfaces` is `both`.

## Force-update preparation

Read `apps/docs/content/developers/extending/force-update-gate.mdx`,
`packages/cms/src/lib/graphql/pageForceUpdate.graphql` and the gate implementation. The note helper
deliberately rejects gate entries. Use the CMA directly with the selected environment and token;
authenticate in headers, never in a URL or a logged shell command.

The latest **published** `pageForceUpdate` wins, even when inactive. Staging means saving an
UNPUBLISHED draft. Publishing a new inactive gate can disable the current gate. Unpublishing it can
resurrect an older gate. Prepare one intended entry and keep its identity throughout the operation.

1. Read CMA `content_types/pageForceUpdate`, `locales` and all
   `entries?content_type=pageForceUpdate` pages. Record IDs, fields, `sys.version` and publication
   state. CMA fields may contain edits that are not live: inspect the delivery response or the last
   published snapshot for the actual live configuration. Resolve the app's newest published gate.
2. If multiple published gates exist, or the live gate differs from the intended entry, show the
   conflict and require a choice before preparing changes to it. Preserve the existing live state.
   A new gate may be drafted when none exists. A successor to an existing gate requires an explicit
   transition decision; do not silently make a new published winner.
3. Verify the requested native minimum against production Play audience availability. A successful
   EAS build, a GitHub tag, an internal-track upload or an OTA update is insufficient. The app reads
   `nativeApplicationVersion`; `__DEV__` builds always bypass the gate. Unknown store availability
   blocks activation. Record the reason older versions cannot remain supported.
4. Save current entry JSON and published configuration locally for rollback. Build a complete
   localized CMA `fields` payload by changing only the intended `minVersion`, `effectiveAt`, `active`,
   copy and `updateCta` link. Preserve every other field, locale and metadata. Verify the linked
   `componentButton` is published and its URL leads to the available Android store build.
5. A selected live draft uses `PUT entries/<id>` with `X-Contentful-Content-Type: pageForceUpdate`
   and `X-Contentful-Version: <reviewed-version>`; a new stable entry uses version `0`. Read it back.
   This changes a working draft, not the published gate. A mock only writes the payload locally.
6. Prepare the activation handoff: re-read and compare version and current published gate, review
   the entire entry because publish includes every pending edit, then
   `PUT entries/<id>/published` with the exact reviewed version. Never auto-retry a conflict.

The handoff must contain space/environment, entry ID/version, minimum native version, store URL and
availability evidence, affected audience, effective time with timezone, copy and a verification plan.
Test one below-minimum and one allowed production-style native build. Test foreground refresh and
offline cached behavior; a dev-build screenshot cannot validate the gate.

Rollback is a versioned update of the **same entry** to `active:false`, preserving its other fields,
followed by republishing that entry. Prepare that payload and command too. An offline phone can
retain the last successful gate; rollback takes effect when it refreshes, not instantly offline.

CMA requires the full current body and optimistic versions. See
[Contentful's update rules](https://www.contentful.com/developers/docs/references/content-management-api/overview/#updating-and-version-locking).
