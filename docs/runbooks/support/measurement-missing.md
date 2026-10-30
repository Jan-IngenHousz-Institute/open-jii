# measurement-missing

**A researcher says a measurement never reached the platform.** Every other runbook starts from an
alert; this one starts from one person's data. Find the last hop the measurement reached, then say
what a miss at the next hop means: delayed, lost, refused, or there all along.

## What to ask for

- The environment and the experiment.
- The phone's thing name, which is its MQTT client id and `client_id` downstream, or the sensor's
  `device_id`.
- A window in UTC, as narrow as they can make it.
- What the phone's Recent screen shows for the reading: a green cloud, or a red line under it.

Any one of the experiment, the phone or the window is enough to start, and each extra one narrows
every query below.

The researcher's window is when they measured. The broker, the archive and bronze see a reading
when the phone published it, which for a reading taken offline is when the phone came back online:
on 26 October 2026 a phone published 225 readings, taken over two and a half hours, in 43 seconds
two hours after the last of them. Search those hops from the measurement onwards, not only inside
the researcher's window.

## 1. The phone

A green cloud means the broker acknowledged the message, and nothing more. Every hop after the
broker can still delay or lose it, so go to step 2.

A reading without one never left the phone, or was refused on the way. Eliminate the causes in this
order, cheapest first. The red line under the reading names most of them, and
`apps/docs/content/guide/measuring/offline-sync.mdx` has the table the researcher sees.

1. **Offline.** Uploads pause without a connection, and every unsynced reading is tried again at
   start-up, on reconnect and on return to the foreground.
2. **Session expired** ("Your session expired"). Signing in again and uploading fixes it.
3. **No longer allowed** ("You can no longer upload to this experiment"). The researcher lost access
   or the experiment was deleted; restore the access, or export the reading.
4. **Refused by the platform** ("The server would not accept this measurement"). Storage refused a
   large payload; export the reading and look at it.
5. **Anything else** ("Upload failed"), after three tries about 1, 4 and 15 seconds apart. Look for
   the phone's errors in PostHog by app version and time, as `openjii-triage` does for an issue.

A broker refusal reaches the phone as a timeout, so it shows as cause 5. Step 2 finds it.

## 2. The broker

IoT Core logs at INFO, so `AWSIotLogsV2` holds every publish the broker accepted or refused and
every run of the topic rule that hands it on, both under the phone's thing name, for 30 days:

```bash
aws logs filter-log-events --profile openjii-<env> --log-group-name AWSIotLogsV2 \
  --start-time <epoch ms> --end-time <epoch ms> \
  --filter-pattern '{ ($.eventType = "Publish-In" || $.eventType = "RuleExecution") && $.clientId = "<thing name>" }' \
  --query 'events[].message' --output text | tr '\t' '\n' \
  | jq -r '[.timestamp, .eventType, .status, .topicName, (.ruleName // ""), (.reason // "")] | @tsv'
```

- **`Publish-In` success.** The broker took it. The ingest rule then logs two runs per message, one
  for the stream and one for the archive; the device-lifecycle rule's runs are the phone connecting
  and disconnecting. Go on.
- **`Publish-In` failure.** Refused. `PAYLOAD_LIMIT_EXCEEDED` is the 128 KiB limit, which app builds
  since #2123 avoid by sending large readings over HTTP; no reason means an auth refusal.
  `rejected-publishes.md` takes it from there.
- **`RuleExecution` failure.** The rule could not deliver it to the stream or the archive. The
  message is under `iot-rule-errors/`, and `ingest-forwarding-failures.md` says how to recover it.
- **Nothing.** The phone did not publish in that window. Widen it forward first, because an offline
  phone publishes its backlog when it reconnects. Still nothing, and the reading is on the phone:
  go back to step 1.

## 3. The raw archive

The rule writes every message, with its topic and client added, to
`s3://open-jii-iot-raw-archive-<env>/raw-iot/<yyyy>/<MM>/<dd>/`. The day is when Firehose received
it, which for a reading taken offline can be later than its measurement. The objects are gzipped,
one JSON message per line. This is the last place a measurement carries its
own id, `_client_id`, the phone's row UUID:

```bash
aws s3 cp --profile openjii-<env> --recursive \
  s3://open-jii-iot-raw-archive-<env>/raw-iot/<yyyy>/<MM>/<dd>/ ./archive/
for f in ./archive/*; do gzip -dc "$f"; done \
  | jq -c 'select(.client_id == "<thing name>") | {topic, _client_id, timestamp}'
```

Firehose writes an object 15 minutes after the first message it buffered, so the newest quarter of
an hour is not there yet. A message the broker
accepted that is missing here was dropped by the archive's half of the rule only, which
`ingest-forwarding-failures.md` covers; the stream may still have it.

## 4. The stream

Kinesis keeps records for 24 hours and cannot be searched by content, so ask it one question: was
the consumer reading during the window? Read `GetRecords.Success` and
`GetRecords.IteratorAgeMilliseconds` on `open-jii-<env>-data-ingest-stream`. Both have no datapoints
while the consumer is stopped, as on prod from 12:15 to 16:15 UTC on 16 October 2026, when
`ingest-idle.md` fired. Records under 24 hours old are delayed, not lost.

## 5. The lakehouse

Query the tables through the Investigations warehouse, which exists so people's queries do not wake
the backend's warehouse. `<profile>` is your Databricks CLI profile for the environment
(`docs/agents/environments.md`). Pass values as named parameters rather than pasting them into the
SQL:

```bash
WH=$(databricks warehouses list -p <profile> -o json | jq -r '.[] | select(.name == "Investigations") | .id')
SQL='SELECT kinesis_arrival_time, ingestion_timestamp, experiment_id, parsed_data.device_id,
       parsed_data.timestamp
     FROM open_jii_<env>.centrum.raw_data
     WHERE client_id = :client AND kinesis_arrival_time BETWEEN :from AND :to
     ORDER BY kinesis_arrival_time'
databricks api post /api/2.0/sql/statements -p <profile> --json "$(jq -n \
  --arg wh "$WH" --arg sql "$SQL" --arg client '<thing name>' \
  --arg from '<UTC start>' --arg to '<UTC end>' \
  '{warehouse_id: $wh, statement: $sql, wait_timeout: "50s", parameters: [
     {name: "client", value: $client},
     {name: "from", value: $from, type: "TIMESTAMP"},
     {name: "to", value: $to, type: "TIMESTAMP"}]}')" \
  | jq '.status.state, .result.data_array'
```

A failed statement still answers with HTTP 200; its `status.state` is `FAILED` and `status.error`
says why. In bronze, `ingestion_timestamp` minus `kinesis_arrival_time` is how long the stream held
a message: during the stall of 16 October 2026 it reached 242 minutes, and every message arrived.
Silver and gold are searched by the measurement's own `timestamp`. The tables are in
`open_jii_<env>.centrum`, in path order:

| Hop    | Table                 | Find it by                                             | Missing here, present upstream                                                                         |
| ------ | --------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Bronze | `raw_data`            | `client_id`, `experiment_id`, `kinesis_arrival_time`   | The consumer has not read it yet (step 4).                                                             |
| Silver | `clean_data`          | `client_id`, `device_id`, `experiment_id`, `timestamp` | It had no `timestamp`, which silver drops, or silver has not caught up.                                |
| Gold   | `experiment_raw_data` | `client_id`, `device_id`, `experiment_id`, `timestamp` | It carried no experiment, which gold drops, or gold has not refreshed (`gold-materialization-age.md`). |

A row in gold is what the platform shows. If the researcher still cannot see it, look at how the
web view filters it, not at the pipeline.

## The large-payload path

A reading over 128 KiB never passes the broker or the archive. The phone asks the API for an upload
URL and puts the file at
`s3://open-jii-large-iot-<env>/large-iot/<experiment id>/<user id>/<upload id>.json`.
Guest uploads add `guest/` between the experiment and user IDs. All IDs are lowercase.
The signed key supplies the experiment and uploader, overriding the payload's `user_id`
and each annotation's `createdBy`, and clears `createdByName`. Older researcher keys
without a user segment retain the payload's user and annotation authors. Older guest
keys and unparsed keys clear `user_id` and both annotation author fields. Even for
unparsed keys, the experiment comes only from the path, never the payload.
Bronze reads it into `raw_large_data` by experiment, and silver adds it to `clean_data` with no
`client_id` and no `arrival_timestamp`. Look for the object by experiment and time, then for the row
in silver by experiment and `timestamp`. The only earlier record is the request for the upload
URL, which the backend logs as `getIotUploadUrl` with the experiment id.

## What cannot be traced

- **One measurement past the archive.** Bronze drops `_client_id`, so from bronze on a measurement
  is found by its phone or device and its time, not by its own id. Keeping `_client_id` as a column
  through gold would make a single measurement traceable end to end.
- **A re-sent measurement.** Nothing deduplicates a publish the phone repeats after a crash between
  the broker's acknowledgement and saving it as synced, so the same reading can arrive twice, with
  the same `_client_id` in the archive.
- **The stream after 24 hours**, and the archive's newest quarter of an hour before Firehose
  writes it.

## Reporting back

Name the last hop the measurement reached, show the query result that proves it, and say what that
means for the researcher: it is delayed and will arrive, it is lost and can be recovered from the
archive or `iot-rule-errors/`, the phone has to act, or it is already there.
