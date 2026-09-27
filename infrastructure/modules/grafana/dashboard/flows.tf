# Flow dashboards
#
# The heartbeat reports say whether something needs a person; these are where they look
# closer. Each follows one thing through the platform, a section per hop in the order it
# travels, so the hop where a problem starts is the first one that looks wrong: a researcher's
# request, a device's measurement, and a change on its way to production. Throughput and
# storage sits beside them: how much the platform moves and holds, and how close it runs to its limits.
locals {
  flow_dashboards = {
    platform = {
      title       = "Platform"
      description = "The platform researchers use, hop by hop as a request travels: the site, the server that renders its pages, the API, the database, and the calibration sandbox the API runs on request."
      from        = "now-24h"
    }
    "data-pipeline" = {
      title       = "Data pipeline"
      description = "A device's measurement, hop by hop: IoT Core, the Kinesis stream, the lakehouse, and the macro sandboxes the pipeline runs through the API."
      from        = "now-24h"
    }
    "throughput-storage" = {
      title       = "Throughput and storage"
      description = "How much the platform moves and holds: the ingest stream's throughput against its limits, and every store's size and growth."
      from        = "now-7d"
    }
    delivery = {
      title       = "Delivery"
      description = "Deploys per service from GitHub Actions: how often, how many failed, and how long from commit to production."
      from        = "now-30d"
    }
  }

  flow_uids  = { for key, flow in local.flow_dashboards : key => "${var.environment}-${key}" }
  flow_order = ["platform", "data-pipeline", "throughput-storage", "delivery"]

  # A report signal opens the flow its area sits on; a platform number, the flow of what it measures.
  flow_by_area = {
    web       = "platform"
    api       = "platform"
    ingest    = "data-pipeline"
    lakehouse = "data-pipeline"
    sandboxes = "data-pipeline"
    volume    = "data-pipeline"
    latency   = "data-pipeline"
    path      = "data-pipeline"
  }
  flow_by_namespace = {
    "AWS/Route53"  = "platform"
    "AWS/RDS"      = "platform"
    "AWS/Kinesis"  = "data-pipeline"
    "DORA/Metrics" = "delivery"
  }

  heartbeat_flows = {
    for m in local.heartbeat_live : m.id => lookup(local.flow_by_area, try(m.area, ""), lookup(local.flow_by_namespace, try(m.signal.namespace, ""), ""))
  }

  heartbeat_flow_links = {
    for m in local.heartbeat_live : m.id => [
      for key in compact([local.heartbeat_flows[m.id]]) : {
        title       = "${local.flow_dashboards[key].title} dashboard"
        url         = "/d/${local.flow_uids[key]}?$${__url_time_range}"
        targetBlank = false
      }
    ]
  }

  # A window picked while investigating carries across, except into Delivery, whose deploys
  # are too sparse to read over a day, and Throughput and storage, whose growth needs its week.
  flow_header_links = {
    for key, flow in local.flow_dashboards : key => {
      title       = flow.title
      type        = "link"
      icon        = "dashboard"
      url         = "/d/${local.flow_uids[key]}"
      tooltip     = flow.description
      tags        = []
      asDropdown  = false
      targetBlank = false
      includeVars = false
      keepTime    = !contains(["delivery", "throughput-storage"], key)
    }
  }

  flow_links = {
    for key, flow in local.flow_dashboards : key => concat(
      [
        { title = "Daily report", type = "link", icon = "dashboard", url = "/d/${local.heartbeat_daily_uid}", tooltip = "", targetBlank = false, asDropdown = false, includeVars = false, keepTime = false, tags = [] },
        { title = "Weekly report", type = "link", icon = "dashboard", url = "/d/${local.heartbeat_weekly_uid}", tooltip = "", targetBlank = false, asDropdown = false, includeVars = false, keepTime = false, tags = [] },
      ],
      [for other in local.flow_order : local.flow_header_links[other] if other != key],
    )
  }

  flow_row = { type = "row", collapsed = false, panels = [] }

  # A few lines beside a section on what to check first, never a restatement of its charts.
  flow_caption = { type = "text", title = "", transparent = true }

  flow_templates = {
    for key in ["platform", "data-pipeline"] : key => {
      for section in jsondecode(templatefile("${path.module}/flows/${key}.json.tftpl", local.dashboard_vars)).sections :
      section.key => section.panels
    }
  }

  # A hop keeps one colour on every chart, in the order a thing travels through its flow; a
  # series that spans the whole flow, or watches the monitoring, stays neutral.
  flow_hop_colours = {
    platform        = { site = "blue", page = "purple", api = "green", database = "yellow", calibration = "orange" }
    "data-pipeline" = { devices = "blue", stream = "purple", lakehouse = "green", experiments = "yellow", macros = "orange", whole = "text" }
  }

  flow_signal_hops = {
    "published-by-devices"       = "devices"
    "rejected-publishes"         = "devices"
    "rule-parse-errors"          = "devices"
    "iot-auth-failures"          = "devices"
    "silent-devices"             = "devices"
    "ingest-forwarding-failures" = "stream"
    "ingest-lag"                 = "stream"
    "ingested-rows"              = "lakehouse"
    "ingest-latency"             = "lakehouse"
    "ingest-idle"                = "lakehouse"
    "ingest-bad-payload-rate"    = "lakehouse"
    "experiment-rows"            = "experiments"
    "experiment-latency"         = "experiments"
    "gold-materialization-age"   = "experiments"
    "stale-experiments"          = "experiments"
    "macro-result-rows"          = "macros"
    "macro-latency"              = "macros"
    "macro-idle"                 = "macros"
    "macro-backlog"              = "macros"
    "broker-to-api-latency"      = "whole"
    "dlt-heartbeat"              = "whole"
    "metrics-mv-freshness"       = "whole"
    "metrics-forwarder-errors"   = "whole"
  }

  flow_signal_colours = { for id, hop in local.flow_signal_hops : id => local.flow_hop_colours["data-pipeline"][hop] }

  flow_pipeline_series = {
    for m in local.heartbeat_daily_ordered : m.id => {
      name   = m.name
      unit   = local.heartbeat_facts[m.id].unit
      colour = lookup(local.flow_signal_colours, m.id, "text")
      links  = [{ title = "Over time", url = "/d/${local.heartbeat_daily_uid}?viewPanel=${m.num}&$${__url_time_range}", targetBlank = false }]
      target = merge(local.heartbeat_readings[m.id], { refId = "P${m.num}", id = "p${m.num}" })
    }
  }

  # The catalogue's sandbox errors count the calibration sandbox too, which serves Platform.
  flow_pipeline_macro_errors = {
    name   = "Macro errors"
    unit   = "short"
    colour = local.flow_hop_colours["data-pipeline"].macros
    links  = []
    target = merge(local.heartbeat_readings["sandbox-errors"], {
      refId      = "macro_errors"
      id         = "macro_errors"
      expression = "SUM([TIME_SERIES(0), SUM(FILL(SEARCH('{AWS/Lambda,FunctionName} MetricName=\"Errors\" AND (${join(" OR ", [for name in values(var.macro_sandbox_function_names) : "FunctionName=\"${name}\""])})', 'Sum'), 0))])"
    })
  }

  # Beside the report's two charts, what fails and what has stopped. Half-hour points, the
  # exporter's bucket.
  flow_pipeline_charts = {
    errors = {
      id          = 922
      title       = "Errors"
      description = "What failed along the path per half hour: publishes the broker refused, messages the IoT rule could not parse, measurements it could not forward to the stream, and macro runs that failed. The legend totals the time range."
      calcs       = ["sum"]
      inputs      = []
      series = [
        local.flow_pipeline_series["rejected-publishes"],
        local.flow_pipeline_series["rule-parse-errors"],
        local.flow_pipeline_series["ingest-forwarding-failures"],
        local.flow_pipeline_macro_errors,
      ]
    }
    freshness = {
      id          = 923
      title       = "Freshness"
      description = "Minutes since each stage last moved: how far the stream's reader is behind, since the lakehouse last took rows in, the experiment tables' age, and since macros last wrote results."
      calcs       = ["lastNotNull", "max"]
      # The stream reports its lag in milliseconds.
      inputs = [merge(local.heartbeat_readings["ingest-lag"], { refId = "lag", id = "lag", hide = true })]
      series = [
        merge(local.flow_pipeline_series["ingest-lag"], {
          unit   = "m"
          target = merge(local.flow_pipeline_series["ingest-lag"].target, { expression = "lag / 60000", metricEditorMode = 1 })
        }),
        local.flow_pipeline_series["ingest-idle"],
        local.flow_pipeline_series["gold-materialization-age"],
        local.flow_pipeline_series["macro-idle"],
      ]
    }
  }

  flow_pipeline_chart_panels = {
    for key, chart in local.flow_pipeline_charts : key => {
      id          = chart.id
      type        = "timeseries"
      title       = chart.title
      description = chart.description
      datasource  = local.heartbeat_datasource
      gridPos     = { h = 10, w = 18, x = 6, y = 1 }
      fieldConfig = {
        defaults = {
          min    = 0
          color  = { mode = "palette-classic" }
          custom = { drawStyle = "line", lineWidth = 2, fillOpacity = 8, showPoints = "never", spanNulls = 3600000 }
        }
        overrides = [
          for series in chart.series : {
            matcher = { id = "byFrameRefID", options = series.target.refId }
            properties = [
              { id = "displayName", value = series.name },
              { id = "unit", value = series.unit },
              { id = "color", value = { mode = "fixed", fixedColor = series.colour } },
              { id = "links", value = series.links },
            ]
          }
        ]
      }
      options = {
        legend  = { displayMode = "table", placement = "bottom", showLegend = true, calcs = chart.calcs }
        tooltip = { mode = "multi", sort = "none" }
      }
      targets = concat(
        [for input in chart.inputs : merge(input, { period = "1800" })],
        [for series in chart.series : merge(series.target, { period = "1800" })],
      )
    }
  }

  flow_pipeline_glance = concat(
    [merge(local.flow_row, { id = 920, title = "At a glance", gridPos = { h = 1, w = 24, x = 0, y = 0 } })],
    [
      for i, id in ["published-by-devices", "experiment-rows", "broker-to-api-latency", "macro-backlog", "ingest-lag"] : merge(local.heartbeat_level_tiles[id], {
        gridPos = { h = 3, w = 4, x = i * 4, y = 1 }
      })
    ],
    [{
      id            = 921
      type          = "stat"
      title         = "Errors"
      description   = "Everything the Errors chart below counts, totalled over the time range."
      pluginVersion = "10.4.1"
      datasource    = local.heartbeat_datasource
      gridPos       = { h = 3, w = 4, x = 20, y = 1 }
      fieldConfig = {
        defaults = {
          noValue    = "0"
          unit       = "short"
          color      = { mode = "thresholds" }
          thresholds = { mode = "absolute", steps = [{ color = "text", value = null }] }
        }
        overrides = []
      }
      options = {
        colorMode         = "value"
        graphMode         = "area"
        justifyMode       = "center"
        orientation       = "auto"
        textMode          = "value"
        text              = { titleSize = 13, valueSize = 26 }
        wideLayout        = true
        showPercentChange = false
        reduceOptions     = { calcs = ["sum"], fields = "", values = false }
      }
      targets = concat(
        [for target in local.flow_pipeline_chart_panels.errors.targets : merge(target, { hide = true })],
        [merge(local.flow_pipeline_chart_panels.errors.targets[0], {
          refId      = "errors"
          id         = "errors"
          expression = join(" + ", [for target in local.flow_pipeline_chart_panels.errors.targets : target.id])
        })],
      )
    }],
  )

  # What devices send, from the IoT rule that copies a random share of ingest messages to a log
  # group kept a few days. Collapsed, since it shows research data only to whoever opens it.
  flow_payload_panels = [merge(local.flow_row, {
    id        = 906
    title     = "Recent payloads"
    collapsed = true
    gridPos   = { h = 1, w = 24, x = 0, y = 0 }
    panels = [{
      id          = 907
      type        = "table"
      title       = "Sampled payloads"
      description = "A random share of the messages devices published, newest first, with each one's size and the start of its content. The IoT rule sets the share; samples are kept a few days."
      datasource  = { type = "cloudwatch", uid = grafana_data_source.cloudwatch_logs_source.uid }
      gridPos     = { h = 14, w = 24, x = 0, y = 1 }
      fieldConfig = {
        defaults = { noValue = "-", custom = { align = "auto", cellOptions = { type = "auto" }, inspect = true } }
        overrides = [
          { matcher = { id = "byName", options = "@timestamp" }, properties = [{ id = "displayName", value = "Time" }, { id = "custom.width", value = 170 }] },
          { matcher = { id = "byName", options = "device" }, properties = [{ id = "displayName", value = "Device" }, { id = "custom.width", value = 200 }] },
          { matcher = { id = "byName", options = "experiment" }, properties = [{ id = "displayName", value = "Experiment" }, { id = "custom.width", value = 310 }] },
          { matcher = { id = "byName", options = "family" }, properties = [{ id = "displayName", value = "Family" }, { id = "custom.width", value = 80 }] },
          { matcher = { id = "byName", options = "bytes" }, properties = [{ id = "displayName", value = "Size" }, { id = "unit", value = "bytes" }, { id = "custom.width", value = 90 }] },
          { matcher = { id = "byName", options = "preview" }, properties = [{ id = "displayName", value = "Payload" }, { id = "custom.minWidth", value = 360 }] },
        ]
      }
      options = {
        sortBy     = [{ displayName = "Time", desc = true }]
        showHeader = true
        cellHeight = "sm"
        footer     = { show = false, reducer = ["sum"], countRows = false, fields = "" }
      }
      transformations = [{
        id = "organize"
        options = {
          indexByName   = { "@timestamp" = 0, Time = 0, device = 1, experiment = 2, family = 3, bytes = 4, preview = 5 }
          excludeByName = { family_version = true, sensor = true }
        }
      }]
      targets = [{
        refId       = "A"
        datasource  = { type = "cloudwatch", uid = grafana_data_source.cloudwatch_logs_source.uid }
        queryMode   = "Logs"
        region      = var.aws_region
        statsGroups = []
        id          = ""
        expression  = "fields @timestamp, client_id as device, strlen(@message) as bytes, substr(@message, 0, 300) as preview\n| parse topic \"experiment/data_ingest/v1/*/*/*/*\" as experiment, family, family_version, sensor\n| sort @timestamp desc\n| limit 200"
        logGroups = [{
          accountId = data.aws_caller_identity.current.account_id
          arn       = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:${var.payload_samples_log_group_name}:*"
          name      = var.payload_samples_log_group_name
        }]
      }]
    }]
  })]

  # The GitHub action publishes each deploy under its service, so a search reads every service
  # without listing them.
  flow_dora_search = "SEARCH('{DORA/Metrics,Environment,Service} MetricName=\"%s\" AND Environment=\"${var.environment}\"', '%s')"

  flow_dora_query = {
    region           = var.aws_region
    namespace        = "DORA/Metrics"
    queryMode        = "Metrics"
    metricQueryType  = 0
    metricEditorMode = 1
    metricName       = ""
    statistic        = "Sum"
    matchExact       = false
    dimensions       = {}
    label            = ""
    hide             = false
  }

  flow_dora_totals = {
    attempts  = format("SUM(FILL(%s, 0))", format(local.flow_dora_search, "DeploymentFrequency", "Sum"))
    successes = format("SUM(FILL(%s, 0))", format(local.flow_dora_search, "DeploymentSuccess", "Sum"))
    failures  = format("SUM(FILL(%s, 0))", format(local.flow_dora_search, "DeploymentFailed", "Sum"))
    lead_sum  = format("SUM(%s)", format(local.flow_dora_search, "LeadTime", "Sum"))
    lead_n    = format("SUM(%s)", format(local.flow_dora_search, "LeadTime", "SampleCount"))
  }

  # The latest week against the week before, as on the weekly report. Grafana 10.4 colours
  # every drop red, so where a drop is good news the tile shows the level alone. Lead time is
  # a mean over every deploy, not over each service's own average.
  flow_delivery_tiles = [
    {
      title       = "Deploys"
      description = "Deploy attempts in the latest week, successful or not, against the week before."
      unit        = "short"
      red_from    = null
      no_value    = "0"
      change      = true
      targets     = [merge(local.flow_dora_query, { refId = "A", id = "a", expression = local.flow_dora_totals.attempts })]
    },
    {
      title       = "Successful"
      description = "Deploys that finished in the latest week, against the week before."
      unit        = "short"
      red_from    = null
      no_value    = "0"
      change      = true
      targets     = [merge(local.flow_dora_query, { refId = "A", id = "a", expression = local.flow_dora_totals.successes })]
    },
    {
      title       = "Failed"
      description = "Deploys that failed in the latest week."
      unit        = "short"
      red_from    = 1
      no_value    = "0"
      change      = false
      targets     = [merge(local.flow_dora_query, { refId = "A", id = "a", expression = local.flow_dora_totals.failures })]
    },
    {
      title       = "Failed deploy rate"
      description = "Deploy runs that failed, as a share of attempts in the latest week. Not DORA's change failure rate, which counts deploys that broke production."
      unit        = "percent"
      red_from    = null
      no_value    = "No deploys"
      change      = false
      targets = [
        merge(local.flow_dora_query, { refId = "attempts", id = "attempts", expression = local.flow_dora_totals.attempts, hide = true }),
        merge(local.flow_dora_query, { refId = "failures", id = "failures", expression = local.flow_dora_totals.failures, hide = true }),
        merge(local.flow_dora_query, { refId = "rate", id = "rate", expression = "100 * failures / attempts" }),
      ]
    },
    {
      title       = "Lead time"
      description = "Mean time from commit to production over the latest week's deploys."
      unit        = "ms"
      red_from    = null
      no_value    = "No deploys"
      change      = false
      targets = [
        merge(local.flow_dora_query, { refId = "total", id = "total", expression = local.flow_dora_totals.lead_sum, hide = true }),
        merge(local.flow_dora_query, { refId = "count", id = "count", expression = local.flow_dora_totals.lead_n, hide = true }),
        merge(local.flow_dora_query, { refId = "lead", id = "lead", expression = "total / count" }),
      ]
    },
  ]
  flow_delivery_tile_widths = [5, 5, 5, 5, 4]

  flow_delivery_services = [
    { title = "Deploys by service", metric = "DeploymentFrequency", stat = "Sum", calc = "sum", unit = "short", colour = "blue" },
    { title = "Lead time by service", metric = "LeadTime", stat = "Average", calc = "mean", unit = "ms", colour = "purple" },
    { title = "Successful by service", metric = "DeploymentSuccess", stat = "Sum", calc = "sum", unit = "short", colour = "green" },
    { title = "Failed by service", metric = "DeploymentFailed", stat = "Sum", calc = "sum", unit = "short", colour = "red" },
  ]

  flow_delivery_panels = concat(
    [merge(local.flow_row, { id = 1, title = "This week", gridPos = { h = 1, w = 24, x = 0, y = 0 } })],
    [
      for i, tile in local.flow_delivery_tiles : {
        id               = 2 + i
        type             = "stat"
        title            = tile.title
        description      = tile.description
        pluginVersion    = "10.4.1"
        datasource       = local.heartbeat_datasource
        timeFrom         = "14d"
        hideTimeOverride = true
        gridPos          = { h = 4, w = local.flow_delivery_tile_widths[i], x = sum(concat([0], slice(local.flow_delivery_tile_widths, 0, i))), y = 1 }
        fieldConfig = {
          defaults = {
            noValue = tile.no_value
            unit    = tile.unit
            color   = { mode = "thresholds" }
            thresholds = {
              mode = "absolute"
              steps = concat(
                [{ color = "text", value = null }],
                tile.red_from == null ? [] : [{ color = "red", value = tile.red_from }],
              )
            }
          }
          overrides = []
        }
        options = {
          colorMode         = "value"
          graphMode         = "none"
          justifyMode       = "center"
          orientation       = "auto"
          textMode          = "value"
          text              = { titleSize = 13, valueSize = 34 }
          wideLayout        = true
          showPercentChange = tile.change
          reduceOptions     = { calcs = ["lastNotNull"], fields = "", values = false }
        }
        targets = [for target in tile.targets : merge(target, { period = "604800" })]
      }
    ],
    [merge(local.flow_row, { id = 10, title = "Over time", gridPos = { h = 1, w = 24, x = 0, y = 5 } })],
    [merge(local.flow_caption, {
      id      = 9
      gridPos = { h = 8, w = 6, x = 0, y = 6 }
      options = { mode = "markdown", content = "**Failed deploy rate** is deploy runs that failed, not DORA's change failure rate, which counts deploys that broke production and which these numbers cannot see.\n\nEvery deploy workflow reports through the `publish-dora-metrics` action, so a service that deployed and is missing here has a workflow that skips it.\n\nA failed run's reason is in [GitHub Actions](https://github.com/${local.heartbeat_repository}/actions)." }
    })],
    [
      for i, chart in [
        { title = "Deploys by service", description = "Deploy attempts per day, stacked by service.", metric = "DeploymentFrequency", stat = "Sum", unit = "short", bars = true },
        { title = "Lead time by service", description = "Each service's average time from commit to production on the days it deployed.", metric = "LeadTime", stat = "Average", unit = "ms", bars = false },
        ] : {
        id          = 11 + i
        type        = "timeseries"
        title       = chart.title
        description = chart.description
        datasource  = local.heartbeat_datasource
        gridPos     = { h = 8, w = 9, x = 6 + i * 9, y = 6 }
        fieldConfig = {
          defaults = {
            unit  = chart.unit
            color = { mode = "palette-classic" }
            custom = {
              drawStyle   = chart.bars ? "bars" : "points"
              fillOpacity = chart.bars ? 80 : 8
              lineWidth   = 1
              pointSize   = 7
              showPoints  = "always"
              stacking    = { mode = chart.bars ? "normal" : "none", group = "A" }
            }
          }
          overrides = []
        }
        options = {
          legend  = { displayMode = "list", placement = "bottom", showLegend = true }
          tooltip = { mode = "multi", sort = "desc" }
        }
        targets = [merge(local.flow_dora_query, {
          refId      = "A"
          id         = "a"
          statistic  = chart.stat
          expression = format(local.flow_dora_search, chart.metric, chart.stat)
          label      = "$${PROP('Dim.Service')}"
          period     = "86400"
        })]
      }
    ],
    [merge(local.flow_row, { id = 20, title = "By service", gridPos = { h = 1, w = 24, x = 0, y = 14 } })],
    [
      for i, gauge in local.flow_delivery_services : {
        id          = 21 + i
        type        = "bargauge"
        title       = gauge.title
        description = gauge.calc == "sum" ? "Total over the time range." : "Mean of each day's average over the time range."
        datasource  = local.heartbeat_datasource
        gridPos     = { h = 9, w = 12, x = (i % 2) * 12, y = 15 + floor(i / 2) * 9 }
        fieldConfig = {
          defaults = {
            unit     = gauge.unit
            min      = 0
            decimals = gauge.unit == "short" ? 0 : null
            color    = { mode = "fixed", fixedColor = gauge.colour }
          }
          overrides = []
        }
        options = {
          displayMode   = "basic"
          orientation   = "horizontal"
          valueMode     = "text"
          namePlacement = "left"
          showUnfilled  = true
          # Fixed bar heights, so a service or two do not fill the panel in giant type.
          sizing        = "manual"
          minVizHeight  = 16
          maxVizHeight  = 24
          text          = { titleSize = 13, valueSize = 16 }
          reduceOptions = { calcs = ["lastNotNull"], fields = "", values = false }
        }
        # Reduced before drawing, so each bar scales against the other services' totals rather
        # than its own daily values.
        transformations = [{ id = "reduce", options = { reducers = [gauge.calc], mode = "reduceFields", includeTimeField = false } }]
        targets = [merge(local.flow_dora_query, {
          refId      = "A"
          id         = "a"
          statistic  = gauge.stat
          expression = format(local.flow_dora_search, gauge.metric, gauge.stat)
          label      = "$${PROP('Dim.Service')}"
          period     = "86400"
        })]
      }
    ],
  )

  # Platform's four golden signals of the whole request path, as Grafana's dashboard guidance
  # lays them out. Each is one chart built from the queries the hops' own panels run.
  flow_platform_targets = {
    for panel in flatten(values(local.flow_templates.platform)) : tostring(panel.id) => {
      for target in try(panel.targets, []) : target.refId => target
    }
  }

  # An input to an expression, read under its own id and not drawn.
  flow_platform_input = {
    for name, source in {
      page_calls    = ["316", "A"]
      page_errors   = ["316", "B"]
      api_requests  = ["305", "requests"]
      api_errors    = ["305", "errors"]
      sandbox_calls = ["332", "A"]
      sandbox_errs  = ["333", "A"]
      api_p95       = ["306", "A"]
      db_read       = ["327", "A"]
      db_write      = ["327", "B"]
    } : name => merge(local.flow_platform_targets[source[0]][source[1]], { refId = name, id = name, label = "", hide = true })
  }

  flow_platform_expression = merge(local.flow_platform_targets["305"].rate, { hide = false })

  # A second series of the same hop is a shade darker.
  flow_platform_series_colours = {
    site        = local.flow_hop_colours.platform.site
    page        = local.flow_hop_colours.platform.page
    api         = local.flow_hop_colours.platform.api
    api_cpu     = local.flow_hop_colours.platform.api
    api_memory  = "dark-${local.flow_hop_colours.platform.api}"
    read        = local.flow_hop_colours.platform.database
    write       = "dark-${local.flow_hop_colours.platform.database}"
    db_cpu      = local.flow_hop_colours.platform.database
    calibration = local.flow_hop_colours.platform.calibration
  }

  flow_platform_charts = {
    traffic = {
      id          = 351
      title       = "Traffic"
      description = "How much is asked of each hop: site requests, page renders, API requests and calibration runs."
      unit        = "short"
      max         = null
      inputs      = []
      series      = []
      direct = [
        merge(local.flow_platform_targets["310"].A, { refId = "site", label = "Site requests" }),
        merge(local.flow_platform_targets["316"].A, { refId = "page", label = "Page renders" }),
        merge(local.flow_platform_targets["318"].A, { refId = "api", label = "API requests" }),
        merge(local.flow_platform_targets["332"].A, { refId = "calibration", label = "Calibration runs" }),
      ]
    }
    errors = {
      id          = 352
      title       = "Errors"
      description = "The share of work each hop failed: the site's 5xx responses, page renders that errored, the API's 5xx responses and failed calibration runs."
      unit        = "percent"
      max         = null
      inputs      = ["page_calls", "page_errors", "api_requests", "api_errors", "sandbox_calls", "sandbox_errs"]
      series = [
        { key = "page", label = "Page server", expression = "IF(FILL(page_calls, 0) > 0, 100 * FILL(page_errors, 0) / page_calls, 0)" },
        { key = "api", label = "API", expression = "IF(FILL(api_requests, 0) > 0, 100 * FILL(api_errors, 0) / api_requests, 0)" },
        { key = "calibration", label = "Calibration sandbox", expression = "IF(FILL(sandbox_calls, 0) > 0, 100 * FILL(sandbox_errs, 0) / sandbox_calls, 0)" },
      ]
      # CloudFront reports in us-east-1, and an expression cannot reach across regions.
      direct = [merge(local.flow_platform_targets["311"].B, { refId = "site", label = "Site" })]
    }
    latency = {
      id          = 353
      title       = "Latency"
      description = "The slowest twentieth of each hop: the site waiting on its origin, a page render, an API response, and the database's average read and write."
      unit        = "ms"
      max         = null
      inputs      = ["api_p95", "db_read", "db_write"]
      series = [
        { key = "api", label = "API response", expression = "1000 * api_p95" },
        { key = "read", label = "Database read", expression = "1000 * db_read" },
        { key = "write", label = "Database write", expression = "1000 * db_write" },
      ]
      # Already in milliseconds, and the site's in us-east-1, which an expression cannot reach.
      direct = [
        merge(local.flow_platform_targets["313"].B, { refId = "site", label = "Site origin" }),
        merge(local.flow_platform_targets["303"].A, { refId = "page", label = "Page render" }),
      ]
    }
    saturation = {
      id          = 354
      title       = "Saturation"
      description = "How much of what they have the API's tasks and the database use."
      unit        = "percent"
      max         = 100
      inputs      = []
      series      = []
      direct = [
        merge(local.flow_platform_targets["322"].A, { refId = "api_cpu", label = "API CPU" }),
        merge(local.flow_platform_targets["322"].B, { refId = "api_memory", label = "API memory" }),
        merge(local.flow_platform_targets["326"].A, { refId = "db_cpu", label = "Database CPU" }),
      ]
    }
  }

  flow_platform_chart_panels = {
    for key, chart in local.flow_platform_charts : key => {
      id          = chart.id
      type        = "timeseries"
      title       = chart.title
      description = chart.description
      datasource  = local.heartbeat_datasource
      gridPos     = { h = 10, w = 18, x = 6, y = 1 }
      fieldConfig = {
        defaults = {
          unit   = chart.unit
          min    = 0
          max    = chart.max
          color  = { mode = "palette-classic" }
          custom = { drawStyle = "line", lineWidth = 2, fillOpacity = 8, showPoints = "never", spanNulls = true }
        }
        overrides = [
          for ref in concat([for target in chart.direct : target.refId], [for line in chart.series : line.key]) : {
            matcher    = { id = "byFrameRefID", options = ref }
            properties = [{ id = "color", value = { mode = "fixed", fixedColor = local.flow_platform_series_colours[ref] } }]
          }
        ]
      }
      options = {
        legend  = { displayMode = "list", placement = "bottom", showLegend = true }
        tooltip = { mode = "multi", sort = "desc" }
      }
      # The hops in the order a request meets them, which the site's series lead as the first hop.
      targets = concat(
        [for name in chart.inputs : local.flow_platform_input[name]],
        chart.direct,
        [for line in chart.series : merge(local.flow_platform_expression, { refId = line.key, id = line.key, label = line.label, expression = line.expression })],
      )
    }
  }

  flow_runbooks = "${var.runbook_base_url}/docs/runbooks"

  # Every flow reads the same way: a section per question, its chart beside what to check first
  # when it looks wrong, then every hop's own panels on that question in the hop's colour, in the
  # order a thing travels. Numbers are template panel ids, names catalogue signals.
  flow_questions = {
    platform = [
      {
        key     = "traffic"
        chart   = local.flow_platform_chart_panels.traffic
        caption = "**Read the other charts against this one.** An error rate on a handful of requests is noise, and latency often rises with traffic.\n\n- **Every hop drops at once:** the site itself is down; check Site up above.\n- **API requests rise without page renders:** the mobile app and API keys, which call the API directly.\n\nWho is behind the traffic is on the [weekly report](/d/${local.heartbeat_weekly_uid}): active researchers, devices and experiments."
        details = [
          { panel = "310", hop = "site" },
          { panel = "312", hop = "site" },
          { panel = "318", hop = "api" },
          { panel = "321", hop = "api" },
          { panel = "328", hop = "database" },
          { panel = "329", hop = "database" },
          { panel = "332", hop = "calibration" },
        ]
      },
      {
        key     = "errors"
        chart   = local.flow_platform_chart_panels.errors
        caption = "**Work back from the furthest hop that fails**, since each hop fails when the one it calls does.\n\n- **Most spikes start at a deploy:** compare with [Delivery](/d/${local.flow_uids.delivery}) and roll back first. [Runbook](${local.flow_runbooks}/backend-5xx.md)\n- **Every endpoint, database-shaped errors:** one slow query holds its whole task, which keeps a single database connection.\n- **Only data pages:** the Databricks SQL warehouse, not the API."
        details = [
          { panel = "311", hop = "site" },
          { panel = "316", hop = "page" },
          { panel = "319", hop = "api" },
          { panel = "320", hop = "api" },
          { panel = "333", hop = "calibration" },
        ]
      },
      {
        key     = "latency"
        chart   = local.flow_platform_chart_panels.latency
        caption = "**Where the time usually goes:**\n\n- **Page render slow, API fine:** something else the page calls, such as Contentful or the PostHog proxy, or cold starts after a quiet spell. [Runbook](${local.flow_runbooks}/opennext-lambda-errors.md)\n- **Slow only on data pages:** the SQL warehouse resuming from zero, which the first request after idle pays for.\n- **Database latency up:** one slow query queues every request behind it on that task."
        details = [
          { panel = "313", hop = "site" },
          { panel = "315", hop = "page" },
          { panel = "327", hop = "database" },
        ]
      },
      {
        key     = "saturation"
        chart   = local.flow_platform_chart_panels.saturation
        caption = "**Running out of room shows here before it shows as errors.**\n\n- **API CPU or memory near the top:** requests slow first, then tasks get replaced, which Tasks and healthy targets shows.\n- **Database CPU high while traffic is flat:** usually one expensive query. Connections shows how many are held.\n\nHow storage grows over 90 days is on [Throughput and storage](/d/${local.flow_uids["throughput-storage"]})."
        details = [
          { panel = "322", hop = "api" },
          { panel = "323", hop = "api" },
          { panel = "325", hop = "database" },
          { panel = "326", hop = "database" },
          { panel = "330", hop = "database" },
        ]
      },
    ]
    "data-pipeline" = [
      {
        key     = "volume"
        chart   = merge(local.heartbeat_path_charts[0], { title = "Volume", gridPos = { h = 10, w = 18, x = 6, y = 1 } })
        caption = "**When a line falls away from the one before it**, data is held up at that hop.\n\n- **Published, not ingested:** the stream's reader stopped or cannot keep up. [Runbook](${local.flow_runbooks}/ingest-lag.md)\n- **Ingested, not into experiments:** the centrum pipeline failed, is paused, or is stuck on one flow. [Runbook](${local.flow_runbooks}/gold-materialization-age.md)\n- **No macro results:** see Macro errors under Errors.\n\nImports and large payloads skip the broker, so Into experiments can run above Ingested. The stream takes 1,000 records or 1 MiB a second per shard, and has ${var.kinesis_shard_count} ${var.kinesis_shard_count == 1 ? "shard" : "shards"}."
        details = [
          { panel = "502", hop = "devices" },
          { panel = "501", hop = "devices" },
          { panel = "silent-devices", hop = "devices" },
          { panel = "503", hop = "devices" },
          { panel = "504", hop = "devices" },
          { panel = "stale-experiments", hop = "experiments" },
          { panel = "509", hop = "stream" },
          { panel = "508", hop = "stream" },
          { panel = "511", hop = "macros" },
        ]
      },
      {
        key     = "errors"
        chart   = local.flow_pipeline_chart_panels.errors
        caption = "**Most common causes, first to check:**\n\n- **Measurements lost:** an apply changed the IoT rule's role, or the stream is throttling. Only the raw archive can replay them. [Runbook](${local.flow_runbooks}/ingest-forwarding-failures.md)\n- **Refused publishes:** a payload over IoT Core's 128 KiB limit, or a device without permission to publish. The IoT logs at the bottom give each reason.\n- **Parse errors:** a device sent a payload that is not valid JSON.\n- **Macro errors:** on one macro, a researcher iterating; across many, a sandbox deploy. [Runbook](${local.flow_runbooks}/sandbox-errors.md)"
        details = [
          { panel = "iot-auth-failures", hop = "devices" },
          { panel = "ingest-bad-payload-rate", hop = "lakehouse" },
          { panel = "512", hop = "macros" },
          { panel = "514", hop = "macros" },
        ]
      },
      {
        key     = "latency"
        chart   = merge(local.heartbeat_path_charts[1], { title = "Latency", gridPos = { h = 10, w = 18, x = 6, y = 1 } })
        caption = "**Broker to API is what a researcher feels.** The measurement path project aims for 2 to 10 minutes.\n\n- **Arrival to lakehouse climbs:** the centrum pipeline's reader is behind; Ingest lag under Freshness says whether it stopped.\n- **Experiments to macro results climbs:** macro runs slowed down; Run time by language shows which runtime."
        details = [
          { panel = "507", hop = "stream" },
          { panel = "513", hop = "macros" },
        ]
      },
      {
        key     = "freshness"
        chart   = local.flow_pipeline_chart_panels.freshness
        caption = "**Which stage stopped, and what to do:**\n\n- **Ingest lag climbing a minute per minute:** the consumer stopped. Nothing is lost until 24 hours, when Kinesis starts dropping data. It alerts past ${local.heartbeat_limits["ingest-lag"] / 60000} minutes. [Runbook](${local.flow_runbooks}/ingest-lag.md)\n- **Since last ingest and Gold tables age climbing together:** the centrum pipeline failed, is paused, or is stuck on one flow. [Runbook](${local.flow_runbooks}/gold-materialization-age.md)\n- **Collector running at zero or missing:** the lakehouse numbers here are stale, not the platform. [Runbook](${local.flow_runbooks}/dlt-heartbeat.md)"
        details = [
          { panel = "506", hop = "stream" },
          { panel = "ingest-idle", hop = "lakehouse" },
          { panel = "gold-materialization-age", hop = "experiments" },
          { panel = "macro-idle", hop = "macros" },
          { panel = "macro-backlog", hop = "macros" },
          { panel = "dlt-heartbeat", hop = "whole" },
          { panel = "metrics-mv-freshness", hop = "whole" },
          { panel = "metrics-forwarder-errors", hop = "whole" },
        ]
      },
    ]
  }

  # A template's panels by id, and every daily signal's chart by its catalogue id.
  flow_detail_panels = {
    for key in keys(local.flow_questions) : key => merge(
      { for panel in flatten(values(local.flow_templates[key])) : tostring(panel.id) => panel },
      {
        for m in local.heartbeat_daily_ordered : m.id => merge(local.heartbeat_charts[m.id], {
          description = "Investigate with /openjii-triage ${m.id}."
          targets     = [merge(local.heartbeat_queries[m.id], { period = "300" })]
        })
      },
    )
  }

  # Where the jth of n panels sits: at most three to a line, the lines as even as n allows, and
  # each line's panels sharing its width.
  flow_grid = {
    for n in range(1, 13) : tostring(n) => [
      for j in range(n) : {
        size = j < (n % ceil(n / 3)) * (floor(n / ceil(n / 3)) + 1) ? floor(n / ceil(n / 3)) + 1 : floor(n / ceil(n / 3))
        line = (
          j < (n % ceil(n / 3)) * (floor(n / ceil(n / 3)) + 1)
          ? floor(j / (floor(n / ceil(n / 3)) + 1))
          : n % ceil(n / 3) + floor((j - (n % ceil(n / 3)) * (floor(n / ceil(n / 3)) + 1)) / floor(n / ceil(n / 3)))
        )
        column = (
          j < (n % ceil(n / 3)) * (floor(n / ceil(n / 3)) + 1)
          ? j % (floor(n / ceil(n / 3)) + 1)
          : (j - (n % ceil(n / 3)) * (floor(n / ceil(n / 3)) + 1)) % floor(n / ceil(n / 3))
        )
      }
    ]
  }

  flow_question_details = {
    for dashboard, questions in local.flow_questions : dashboard => {
      for question in questions : question.key => [
        for j, detail in question.details : {
          panel = local.flow_detail_panels[dashboard][detail.panel]
          place = local.flow_grid[tostring(length(question.details))][j]
          # Shades of one colour cannot tell several series apart, so only a lone query takes its
          # hop's colour and the rest keep their own.
          coloured = length([for target in try(local.flow_detail_panels[dashboard][detail.panel].targets, []) : target if !try(target.hide, false)]) == 1
          colour   = local.flow_hop_colours[dashboard][detail.hop]
        }
      ]
    }
  }

  flow_question_sections = {
    for dashboard, questions in local.flow_questions : dashboard => {
      for i, question in questions : question.key => concat(
        [merge(local.flow_row, { id = 940 + i, title = question.chart.title, gridPos = { h = 1, w = 24, x = 0, y = 0 } })],
        [merge(local.flow_caption, {
          id      = 950 + i
          gridPos = { h = 10, w = 6, x = 0, y = 1 }
          options = { mode = "markdown", content = question.caption }
        })],
        [question.chart],
        [
          for detail in local.flow_question_details[dashboard][question.key] : merge(detail.panel, {
            gridPos = { h = 7, w = 24 / detail.place.size, x = detail.place.column * 24 / detail.place.size, y = 11 + detail.place.line * 7 }
            fieldConfig = merge(detail.panel.fieldConfig, {
              defaults = merge(detail.panel.fieldConfig.defaults, {
                for name, colour in { color = { mode = "shades", fixedColor = detail.colour } } : name => colour
                if detail.panel.type == "timeseries" && detail.coloured
              })
            })
          })
        ],
      )
    }
  }

  # Sections in the order their thing travels; each is laid out from the top and stacked here.
  flow_layouts = {
    platform = [
      local.flow_templates.platform.glance,
      local.flow_question_sections.platform.traffic,
      local.flow_question_sections.platform.errors,
      local.flow_question_sections.platform.latency,
      local.flow_question_sections.platform.saturation,
      local.flow_templates.platform.logs,
    ]
    "data-pipeline" = [
      local.flow_pipeline_glance,
      local.flow_question_sections["data-pipeline"].volume,
      local.flow_question_sections["data-pipeline"].errors,
      local.flow_question_sections["data-pipeline"].latency,
      local.flow_question_sections["data-pipeline"].freshness,
      local.flow_payload_panels,
      local.flow_templates["data-pipeline"].logs,
    ]
    "throughput-storage" = [local.flow_throughput_panels]
    delivery             = [local.flow_delivery_panels]
  }

  flow_heights = {
    for name, sections in local.flow_layouts : name => [
      for panels in sections : max([for panel in panels : panel.gridPos.y + panel.gridPos.h]...)
    ]
  }

  flow_panels = {
    for name, sections in local.flow_layouts : name => flatten([
      for i, panels in sections : [
        for panel in panels : merge(panel, {
          gridPos = merge(panel.gridPos, { y = panel.gridPos.y + sum(concat([0], slice(local.flow_heights[name], 0, i))) })
        })
      ]
    ])
  }
}

resource "grafana_dashboard" "flow" {
  for_each = local.flow_dashboards

  provider  = grafana.amg
  folder    = grafana_folder.folder.id
  overwrite = true

  config_json = jsonencode(merge(local.heartbeat_dashboard, {
    uid         = local.flow_uids[each.key]
    title       = "${each.value.title} · ${var.environment}"
    description = each.value.description
    tags        = ["flow"]
    time        = { from = each.value.from, to = "now" }
    links       = local.flow_links[each.key]
    panels      = local.flow_panels[each.key]
  }))
}
