# web-regeneration-failures

**Pages the web app tried to regenerate failed three times, so visitors keep getting their old
copy.** The public pages (home, blog, releases, FAQ and the legal pages) are cached. A visit to one
that is more than five minutes old serves the cached copy and queues the page on
`open-jii-<env>-opennext-revalidation.fifo`. The revalidation function then requests the page with a
HEAD request that carries Next's `x-prerender-revalidate` header and no User-Agent. A page that fails
three times moves to `open-jii-<env>-opennext-revalidation-dlq.fifo`, which keeps it for 14 days, so
the rule keeps firing until the queue is purged.

## See which pages failed

```bash
DLQ_URL=$(aws sqs get-queue-url --queue-name open-jii-<env>-opennext-revalidation-dlq.fifo \
  --query QueueUrl --output text)
aws sqs receive-message --queue-url "$DLQ_URL" --max-number-of-messages 10 --visibility-timeout 0
aws logs tail /aws/lambda/open-jii-<env>-opennext-revalidation --since 1h \
  --filter-pattern '"Failed to revalidate"'
```

The log line lists the failed records. A visibility timeout of 0 reads the messages without taking
them off the queue.

## Likely causes, most common first

- **The web ACL blocked the request.** `BlockNoUserAgentRule` lets a HEAD request with
  `x-prerender-revalidate` through and blocks every other request without a User-Agent. If OpenNext
  starts sending another method or header, the block shows in the WAF log:

  ```bash
  aws logs tail aws-waf-logs-opennext-<env> --since 1h \
    --filter-pattern '{ $.terminatingRuleId = "BlockNoUserAgentRule" }'
  ```

- **The page failed to render.** The server answered the HEAD with an error status, and its log
  at `/aws/lambda/open-jii-<env>-opennext-server` has the cause.
- **The page answered without regenerating.** The function counts a page as failed unless the
  answer carries `x-nextjs-cache: REVALIDATED`, so a page that redirects or is no longer cached
  fails too, even though it answered.

## Closing

Once the cause is fixed, purge the queue so the rule clears. Each page regenerates on its next
visit.

```bash
aws sqs purge-queue --queue-url "$DLQ_URL"
```

Note which cause it was.
