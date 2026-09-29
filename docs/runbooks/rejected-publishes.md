# rejected-publishes

**IoT Core refused a burst of publishes: more than 100 in five minutes.** Each one is a message a
device or phone sent that never reached the platform, and the sender is not told why.

- **Auth errors:** the device is not allowed to publish on that topic, from a wrong policy, a
  certificate attached to the wrong thing, or a topic the app or firmware builds wrongly.
- **Client errors:** the message breaks a broker limit, most often a payload over 128 KiB. The
  broker drops the connection without an acknowledgement, so the phone reads it as a timeout,
  retries the same bytes, and marks the measurement failed.

Prod refuses a few publishes every hour, which the daily report shows as a level. This rule is for
a burst, like the auth errors of 16 to 19 September that reached 143,798 in one hour.

## Who is refused, and on what topic

The broker logs every refusal. Group them by client and topic:

```bash
aws logs filter-log-events --log-group-name AWSIotLogsV2 \
  --start-time $(( ($(date +%s) - 3600) * 1000 )) \
  --filter-pattern '{ $.eventType = "Publish-In" && $.status = "Failure" }' \
  --query 'events[].message' --output text | tr '\t' '\n' \
  | jq -r '[.clientId, .topicName, (.reason // "")] | @tsv' | sort | uniq -c | sort -rn | head
```

A payload refusal carries `PAYLOAD_LIMIT_EXCEEDED` as its reason; an auth refusal carries none.

- **One client, one topic, thousands of times:** a single device stuck retrying. Find its thing in
  the registry and check its certificate and policy.
- **Many clients on the same topic shape:** a release changed the topic, or the policy changed
  under the fleet. Compare with the latest firmware or app release and the IoT policy in
  `infrastructure/modules/iot-core`.
- **Payload limit on phones:** measurements too large to publish. The app has no size guard yet
  (OJD-1954), so the fix is on the phone side.

## Closing

Do not close until the refusals fall back to the usual few an hour, and the device or release
behind the burst is named here.
