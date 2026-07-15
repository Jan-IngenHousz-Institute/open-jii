# Multi-device measurements

openJII can run **one protocol on several sensors of the same type at once** — for example four
devices plugged into a powered USB hub, measuring four leaves in parallel. The mechanism is not
tied to any particular instrument: it works for every sensor family the platform speaks
(MultispeQ, Ambit, generic serial devices). Every sensor still
produces its **own, independent measurement**: its own row in the lakehouse, its own macro output,
its own upload. What ties them together is a single correlation field stamped on each
measurement, so the round can always be joined back together later.

The same model runs on both execution hosts:

- the **mobile app** (field measurements over a USB hub), and
- the **workbook editor on the web platform** (developing and testing protocols and macros).

The walkthrough below shows the web workbook host with four (mocked) devices: connecting them
one by one, a protocol run where one device fails and is retried, a Python macro computing a
distinct value per device, and an inline command fanning out to all four:

<video controls width="100%" preload="metadata">
  <source src="/img/workbooks/multi-device-demo.webm" type="video/webm" />
  Your browser does not support embedded video.
</video>

## The model: one round, N independent measurements

When a measurement step runs, the protocol is sent to **every connected device in parallel**.
Outcomes are per-device — one failing sensor never blocks the others:

- **All succeed** → the round completes with N measurements.
- **Some fail** → the successful measurements are kept; the user can **retry only the failed
  devices** (already-successful ones are not re-scanned) or **continue with the successful ones**.
- Unplugging one device mid-round fails only that device's scan.

There is deliberately **no "run" entity** anywhere in the system. A multi-device round is just N
ordinary measurements that share one extra field in their payload: **`workbook_run_id`**, a UUID
minted once per round. Everything else about a round is derivable — the devices from `device_id`,
the size from a `COUNT(*)`.

The field is **nullable end to end**: single-device measurements, imported data, and everything
recorded before this feature simply carry `NULL` — an unlinked measurement has no
`workbook_run_id`.

## Mobile app: measuring over a USB hub

Plug several sensors into a hub and pair them one by one from the device sheet; connected devices
accumulate (Bluetooth stays single-device and replaces any wired setup). During a measurement the
flow shows per-device progress, and the partial-failure screen offers **Retry failed** /
**Continue with successful**.

On the analysis screen each device's result is shown (and post-processed by the macro)
**individually**. Upload sends **one MQTT message per measurement** — the ordinary envelope plus
the shared `workbook_run_id` — so offline queueing, retries and the ingestion pipeline treat them
exactly like any other measurement.

## Workbook editor: developing against many devices

The workbook toolbar connects devices one at a time (**Connect** → **Add device**); connected
devices appear as chips with individual disconnect. Executable cells then fan out:

- **Protocol** and **Command** cells run on every connected device in parallel. The output cell
  shows one result block per device; failures are listed per device without discarding the
  successful results.
- **Macro** cells run **once per device measurement** — these are distinct measurements taken at
  the same time, so each sensor gets its own derived output. A device whose measurement failed
  carries its error through rather than silently reusing a neighbour's data.

With a single device connected, nothing changes: cells behave exactly as before.

### Mock devices

To exercise the multi-device flow without a hub full of hardware, open a workbook with
`?mockDevices=1` appended to the URL (available outside production builds). The connection-type
dropdown gains a **Mock** option; each *Connect* adds a fake MultispeQ that answers through the
real device driver — framing, timeouts and command queueing all run genuinely, only the wire is
simulated. Mock device 3 fails its first protocol run on purpose, so the partial-failure and
retry paths can be demoed and end-to-end-tested deterministically.

## Data pipeline: joining a round back together

`workbook_run_id` flows from the wire payload through the Silver layer into the per-experiment
gold tables and enriched views, alongside a `protocol_id` column extracted from the MQTT topic
(which protocol produced each row). Analysis that needs "the four leaves measured together" is a
plain group-by:

```sql
SELECT workbook_run_id,
       collect_list(struct(device_id, data)) AS round
FROM   enriched_experiment_raw_data
WHERE  workbook_run_id IS NOT NULL
GROUP  BY workbook_run_id;
```

Rows with `workbook_run_id IS NULL` are ordinary single-device measurements and need no special
handling — the columns are additive and every existing query keeps working.

## Current limits

- All devices in a round run the **same protocol** — heterogeneous setups (a different protocol
  per sensor family) are a separate, planned step.
- On the web, workbook outputs live in output cells; workbook runs are not uploaded as
  measurements, so `workbook_run_id` currently appears only on mobile uploads.
- Battery display tracks the first-connected (primary) device.
