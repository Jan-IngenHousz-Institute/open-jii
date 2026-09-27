# Throughput and storage
#
# How much the platform moves and holds, and how close it runs to its limits: the ingest stream's
# throughput against the ceiling its shards set, and the size and growth of every store. The
# numbers to plan scaling by, where Data pipeline follows a single measurement.
locals {
  # A provisioned shard takes 1 MiB or 1,000 records a second in, and gives 2 MiB a second out.
  throughput_write_limit   = var.kinesis_shard_count * 1048576
  throughput_records_limit = var.kinesis_shard_count * 1000
  throughput_read_limit    = var.kinesis_shard_count * 2097152

  throughput_stream_query = {
    queryMode        = "Metrics"
    metricQueryType  = 0
    metricEditorMode = 0
    region           = var.aws_region
    namespace        = "AWS/Kinesis"
    dimensions       = { StreamName = var.kinesis_stream_name }
    matchExact       = true
    expression       = ""
    label            = ""
    statistic        = "Sum"
  }

  throughput_stream_expression = merge(local.throughput_stream_query, { metricEditorMode = 1, metricName = "" })

  throughput_tile = {
    type          = "stat"
    pluginVersion = "10.4.1"
    datasource    = local.heartbeat_datasource
    options = {
      colorMode         = "value"
      graphMode         = "area"
      justifyMode       = "center"
      orientation       = "auto"
      textMode          = "value"
      text              = { titleSize = 13, valueSize = 30 }
      wideLayout        = true
      showPercentChange = false
    }
  }

  throughput_chart = {
    type       = "timeseries"
    datasource = local.heartbeat_datasource
    options = {
      legend  = { displayMode = "list", placement = "bottom", showLegend = true }
      tooltip = { mode = "multi", sort = "desc" }
    }
  }

  # Limits draw as dashed red lines, so the gap to them is the headroom.
  throughput_limit_line = [
    { id = "custom.lineStyle", value = { fill = "dash", dash = [10, 10] } },
    { id = "custom.fillOpacity", value = 0 },
    { id = "color", value = { mode = "fixed", fixedColor = "red" } },
  ]

  throughput_throughput_tiles = [
    {
      title       = "Data in"
      description = "Bytes the ingest stream took in over the time range."
      unit        = "bytes"
      calc        = "sum"
      thresholds  = []
      targets     = [merge(local.throughput_stream_query, { refId = "A", id = "a", metricName = "IncomingBytes", period = "3600" })]
    },
    {
      title       = "Records in"
      description = "Records, one per published measurement, the ingest stream took in over the time range."
      unit        = "short"
      calc        = "sum"
      thresholds  = []
      targets     = [merge(local.throughput_stream_query, { refId = "A", id = "a", metricName = "IncomingRecords", period = "3600" })]
    },
    {
      title       = "Average record"
      description = "The size of one record, averaged hour by hour over the time range."
      unit        = "bytes"
      calc        = "mean"
      thresholds  = []
      targets = [
        merge(local.throughput_stream_query, { refId = "bytes", id = "bytes", metricName = "IncomingBytes", period = "3600", hide = true }),
        merge(local.throughput_stream_query, { refId = "records", id = "records", metricName = "IncomingRecords", period = "3600", hide = true }),
        merge(local.throughput_stream_expression, { refId = "size", id = "size", period = "3600", expression = "IF(records > 0, bytes / records)" }),
      ]
    },
    {
      title       = "Peak write"
      description = "The busiest minute's bytes a second into the stream over the time range."
      unit        = "Bps"
      calc        = "max"
      thresholds  = []
      targets = [
        merge(local.throughput_stream_query, { refId = "bytes", id = "bytes", metricName = "IncomingBytes", period = "60", hide = true }),
        merge(local.throughput_stream_expression, { refId = "rate", id = "rate", period = "60", expression = "bytes / PERIOD(bytes)" }),
      ]
    },
    {
      title       = "Peak load"
      description = "The busiest minute as a share of what the stream's shards take in a second. Past about 70%, add a shard."
      unit        = "percent"
      calc        = "max"
      thresholds  = [{ color = "orange", value = 70 }, { color = "red", value = 90 }]
      targets = [
        merge(local.throughput_stream_query, { refId = "bytes", id = "bytes", metricName = "IncomingBytes", period = "60", hide = true }),
        merge(local.throughput_stream_expression, { refId = "share", id = "share", period = "60", expression = "100 * bytes / PERIOD(bytes) / ${local.throughput_write_limit}" }),
      ]
    },
    {
      title       = "Consumer lag"
      description = "How far the pipeline's reading fell behind the newest record at worst over the time range."
      unit        = "ms"
      calc        = "max"
      thresholds  = []
      targets     = [merge(local.throughput_stream_query, { refId = "A", id = "a", metricName = "GetRecords.IteratorAgeMilliseconds", statistic = "Maximum", period = "300" })]
    },
  ]

  throughput_stream_charts = [
    {
      title       = "Stream throughput against its limits"
      description = "Bytes a second in from devices and out to the pipeline, each against the ceiling the stream's shards set."
      unit        = "Bps"
      targets = [
        merge(local.throughput_stream_query, { refId = "in_raw", id = "in_raw", metricName = "IncomingBytes", period = "60", hide = true }),
        merge(local.throughput_stream_query, { refId = "out_raw", id = "out_raw", metricName = "GetRecords.Bytes", period = "60", hide = true }),
        merge(local.throughput_stream_expression, { refId = "in", id = "in", period = "60", label = "In", expression = "in_raw / PERIOD(in_raw)" }),
        merge(local.throughput_stream_expression, { refId = "out", id = "out", period = "60", label = "Out", expression = "out_raw / PERIOD(out_raw)" }),
        merge(local.throughput_stream_expression, { refId = "write_limit", id = "write_limit", period = "60", label = "Write limit", expression = "${local.throughput_write_limit} * IF(in_raw, 1, 1)" }),
        merge(local.throughput_stream_expression, { refId = "read_limit", id = "read_limit", period = "60", label = "Read limit", expression = "${local.throughput_read_limit} * IF(in_raw, 1, 1)" }),
      ]
      limits = ["Write limit", "Read limit"]
    },
    {
      title       = "Records against the limit"
      description = "Records a second into the stream against what its shards take, and writes the stream refused for going over."
      unit        = "short"
      targets = [
        merge(local.throughput_stream_query, { refId = "records_raw", id = "records_raw", metricName = "IncomingRecords", period = "60", hide = true }),
        merge(local.throughput_stream_expression, { refId = "records", id = "records", period = "60", label = "Records a second", expression = "records_raw / PERIOD(records_raw)" }),
        merge(local.throughput_stream_expression, { refId = "records_limit", id = "records_limit", period = "60", label = "Record limit", expression = "${local.throughput_records_limit} * IF(records_raw, 1, 1)" }),
        merge(local.throughput_stream_query, { refId = "throttled", id = "throttled", metricName = "WriteProvisionedThroughputExceeded", period = "60", label = "Refused writes" }),
      ]
      limits = ["Record limit"]
    },
  ]

  # Every store's bytes, summed over its storage classes, which S3 reports once a day.
  throughput_stores = merge(
    {
      for name, bucket in var.storage_buckets : name => {
        region     = var.aws_region
        namespace  = "AWS/S3"
        expression = "SUM(SEARCH('{AWS/S3,BucketName,StorageType} MetricName=\"BucketSizeBytes\" BucketName=\"${bucket}\"', 'Average', 86400))"
        metricName = ""
        dimensions = {}
        statistic  = "Average"
      }
    },
    {
      Database = {
        region     = var.aws_region
        namespace  = "AWS/RDS"
        expression = ""
        metricName = "VolumeBytesUsed"
        dimensions = { DBClusterIdentifier = var.db_cluster_identifier }
        statistic  = "Average"
      }
    },
  )

  throughput_store_queries = {
    for name, store in local.throughput_stores : name => {
      queryMode        = "Metrics"
      metricQueryType  = 0
      metricEditorMode = store.expression == "" ? 0 : 1
      matchExact       = true
      region           = store.region
      namespace        = store.namespace
      metricName       = store.metricName
      dimensions       = store.dimensions
      expression       = store.expression
      statistic        = store.statistic
      period           = "86400"
      label            = name
    }
  }

  throughput_store_names = sort(keys(local.throughput_stores))

  flow_throughput_panels = concat(
    [{ id = 400, type = "row", title = "Throughput", collapsed = false, panels = [], gridPos = { h = 1, w = 24, x = 0, y = 0 } }],
    [
      for i, tile in local.throughput_throughput_tiles : merge(local.throughput_tile, {
        id          = 401 + i
        title       = tile.title
        description = tile.description
        gridPos     = { h = 4, w = 4, x = i * 4, y = 1 }
        fieldConfig = {
          defaults = {
            unit       = tile.unit
            noValue    = "0"
            decimals   = tile.unit == "percent" ? 1 : null
            color      = { mode = "thresholds" }
            thresholds = { mode = "absolute", steps = concat([{ color = "text", value = null }], tile.thresholds) }
          }
          overrides = []
        }
        options = merge(local.throughput_tile.options, { reduceOptions = { calcs = [tile.calc], fields = "", values = false } })
        targets = tile.targets
      })
    ],
    [
      for i, chart in local.throughput_stream_charts : merge(local.throughput_chart, {
        id          = 410 + i
        title       = chart.title
        description = chart.description
        gridPos     = { h = 8, w = 9, x = 6 + i * 9, y = 5 }
        fieldConfig = {
          defaults = {
            unit   = chart.unit
            min    = 0
            color  = { mode = "palette-classic" }
            custom = { drawStyle = "line", lineWidth = 2, fillOpacity = 8, showPoints = "never" }
          }
          overrides = concat(
            [for limit in chart.limits : { matcher = { id = "byName", options = limit }, properties = local.throughput_limit_line }],
            [
              for name in ["Refused writes"] : {
                matcher    = { id = "byName", options = name }
                properties = [{ id = "custom.drawStyle", value = "bars" }, { id = "custom.axisPlacement", value = "right" }, { id = "color", value = { mode = "fixed", fixedColor = "orange" } }]
              } if contains([for target in chart.targets : target.label], name)
            ],
          )
        }
        targets = chart.targets
      })
    ],
    [
      merge(local.throughput_chart, {
        id          = 412
        title       = "Data in per day"
        description = "Bytes the ingest stream took in each day over the last 30 days: the curve to plan storage and shards by."
        timeFrom    = "30d"
        gridPos     = { h = 8, w = 9, x = 6, y = 13 }
        fieldConfig = {
          defaults  = { unit = "bytes", min = 0, color = { mode = "fixed", fixedColor = "blue" }, custom = { drawStyle = "bars", fillOpacity = 70, lineWidth = 1 } }
          overrides = []
        }
        targets = [merge(local.throughput_stream_query, { refId = "A", id = "a", metricName = "IncomingBytes", period = "86400", label = "Data in" })]
      }),
      merge(local.throughput_chart, {
        id          = 413
        title       = "Consumer lag"
        description = "How far behind the newest record the pipeline reads. A climb while data arrives steadily means the pipeline cannot keep up."
        gridPos     = { h = 8, w = 9, x = 15, y = 13 }
        fieldConfig = {
          defaults  = { unit = "ms", min = 0, color = { mode = "palette-classic" }, custom = { drawStyle = "line", lineWidth = 2, fillOpacity = 8, showPoints = "never" } }
          overrides = []
        }
        targets = [merge(local.throughput_stream_query, { refId = "A", id = "a", metricName = "GetRecords.IteratorAgeMilliseconds", statistic = "Maximum", period = "300", label = "Lag" })]
      }),
    ],
    [merge(local.flow_caption, {
      id      = 409
      gridPos = { h = 16, w = 6, x = 0, y = 5 }
      options = { mode = "markdown", content = "**The stream's ceiling:** each shard takes 1,000 records or 1 MiB a second in and 2 MiB out, and this stream has ${var.kinesis_shard_count} ${var.kinesis_shard_count == 1 ? "shard" : "shards"}. Writes past it are refused; the IoT rule retries, then drops them. [Runbook](${local.flow_runbooks}/kinesis-write-throttling.md)\n\nA narrow spike is usually one device republishing its backlog after time offline, and passes on its own. A line climbing for days is the fleet outgrowing its shards. Shards are billed by the hour, so confirm the growth before adding them.\n\n**Consumer lag** is how far the lakehouse reads behind. Nothing is lost until it reaches 24 hours, when the stream starts dropping records." }
    })],
    [{ id = 420, type = "row", title = "Storage", collapsed = false, panels = [], gridPos = { h = 1, w = 24, x = 0, y = 21 } }],
    [merge(local.flow_caption, {
      id      = 429
      gridPos = { h = 8, w = 6, x = 0, y = 26 }
      options = { mode = "markdown", content = "S3 reports a bucket's size once a day, so these move daily and today's figure can lag.\n\n**Raw payload archive** is every message the broker accepted, and the one place measurements lost on the way to the stream can be recovered from.\n\nMeasurements live in the lakehouse. The database holds accounts, experiments and devices, so it grows with people rather than with data." }
    })],
    [
      for i, name in local.throughput_store_names : merge(local.throughput_tile, {
        id          = 421 + i
        title       = name
        description = "Its size now, and how much it grew over the last 30 days."
        timeFrom    = "30d"
        gridPos     = { h = 4, w = floor(24 / length(local.throughput_store_names)), x = i * floor(24 / length(local.throughput_store_names)), y = 22 }
        fieldConfig = {
          defaults  = { unit = "bytes", noValue = "No data", color = { mode = "thresholds" }, thresholds = { mode = "absolute", steps = [{ color = "text", value = null }] } }
          overrides = []
        }
        options = merge(local.throughput_tile.options, { showPercentChange = true, reduceOptions = { calcs = ["lastNotNull"], fields = "", values = false } })
        targets = [merge(local.throughput_store_queries[name], { refId = "A", id = "a" })]
      })
    ],
    [
      merge(local.throughput_chart, {
        id          = 430
        title       = "Storage over 90 days"
        description = "Every store's size a day at a time. Lakehouse tables sit in the metastore bucket all environments share, which S3 cannot split by environment."
        timeFrom    = "90d"
        gridPos     = { h = 8, w = 18, x = 6, y = 26 }
        fieldConfig = {
          defaults  = { unit = "bytes", min = 0, color = { mode = "palette-classic" }, custom = { drawStyle = "line", lineWidth = 2, fillOpacity = 8, showPoints = "never", spanNulls = true } }
          overrides = []
        }
        targets = [for i, name in local.throughput_store_names : merge(local.throughput_store_queries[name], { refId = "s${i}", id = "s${i}" })]
      }),
    ],
  )
}
