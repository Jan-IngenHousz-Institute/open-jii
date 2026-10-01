# driver-heap

**A pipeline's driver keeps most of its memory even after a full garbage collection.** The pipeline
still runs, but what the driver holds keeps growing, and once a collection frees almost nothing the
driver collects continuously and every flow in the pipeline stalls. In September, Centrum's driver
passed this limit about eleven hours before it stalled, so there is time to act, but not a weekend.

The heartbeat export reads each classic pipeline's driver log every half hour. The alert's
`Pipeline` label names the pipeline: `centrum` for `Centrum-DLT-Pipeline-<ENV>`, `macro` for
`Macro-Execution-DLT-Pipeline-<ENV>`.

## Confirm it

The driver's GC log is in its `stdout`, under
`/Volumes/<catalog>/centrum/pipeline-logs/<pipeline>/<cluster id>/driver/`, rotated into a file
per hour. The running driver's folder is the one written to last. Each full collection logs the
old generation before and after it:

```
GC(1679) ParOldGen: 7611953K(8388608K)->2376074K(8388608K)
GC(1679) Pause Full (System.gc()) 7438M->2320M(12166M) 7987.687ms
```

The size after the arrow, over the capacity in brackets, is the reading: 28% here. A reading that
climbs from one full collection to the next for hours is a driver keeping memory. One high reading
during a large batch drops back at the next collection.

## Act

- **Restart the pipeline before it reaches 100%.** In the Databricks workspace, stop the pipeline
  and start it again. It comes back on a new cluster with a fresh driver, and its flows resume from
  their checkpoints. Measurements wait in Kinesis while it is down.
- **Then find out what it keeps.** A restart buys about as long as the last climb took. "Reading a
  driver's memory" in
  [Pipeline compute](../../apps/docs/content/developers/architecture/pipeline-compute.mdx)
  describes adding a class histogram to every full collection, which shows what the memory is.

## Closing

Close once the reading has stayed under the limit for a day. Note what the histogram showed here,
so the next occurrence starts from it.
