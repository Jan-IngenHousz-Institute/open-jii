# web-cms-refresh-failures

**The public pages have stopped following Contentful.** The web server keeps each published
Contentful read for an hour (`apps/web/lib/cms-cache.ts`). When the hour is up, the next render reads
Contentful again in the background. If that read fails, Next keeps serving the old value and logs
`revalidating cache with key: <key>` with the error. The pages stay up, but published edits stop
appearing. A metric filter on the server's log group counts the line, and the rule fires when
failures carry on for 15 minutes.

## See what failed

```bash
aws logs tail /aws/lambda/open-jii-<env>-opennext-server --since 1h \
  --filter-pattern '"revalidating cache with key"'
```

The key names the cached read and its arguments, such as the locale or a blog post's slug, and the
error follows it.

## Likely causes

- **Contentful refused the token.** A `401` means the delivery token in the web app's Contentful
  secret was revoked or rotated without updating the secret.
- **The space ran out of its monthly API quota.** A `429` that does not pass is the quota. Contentful
  shows the usage under the space's settings.
- **A query no longer matches the content model.** A GraphQL error naming a field or a type means
  someone changed a content type that the web app queries, or unpublished an entry it links.
- **Contentful itself is down.** `5xx` answers and timeouts pass on their own. Check
  https://www.contentfulstatus.com.

## Closing

Once reads work again, each page picks up current content at its next render, within the hour. Say
in the alert's Slack thread what Contentful answered and when it recovered.
